using System;
using System.Collections;
using UnityEngine;
using ActionWeaponKit.Movement;

namespace ActionWeaponKit.Weapons
{
    /// <summary>
    /// Model-free weapon handling: firing input, magazine/reserve ammunition, reload,
    /// fire modes, screen-center hit ray, camera recoil, switching and inspect hooks.
    /// Does not implement damage, enemies, scoring, missions, UI, visuals or sound.
    /// </summary>
    [DisallowMultipleComponent]
    public sealed class GunController : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private Camera aimCamera;
        [SerializeField] private FirstPersonLook look;
        [SerializeField] private GunDefinition[] guns;
        [SerializeField] private LayerMask hitLayers = ~0;

        [Header("Keys (legacy Unity Input Manager)")]
        [SerializeField] private int fireMouseButton = 0;
        [SerializeField] private KeyCode reloadKey = KeyCode.R;
        [SerializeField] private KeyCode inspectKey = KeyCode.I;
        [SerializeField] private KeyCode previousGunKey = KeyCode.Alpha1;
        [SerializeField] private KeyCode nextGunKey = KeyCode.Alpha2;

        public event Action<GunDefinition> Fired;
        public event Action<GunDefinition, RaycastHit> RayHit;
        public event Action<GunDefinition> ReloadStarted;
        public event Action<GunDefinition> ReloadCompleted;
        public event Action<GunDefinition> Inspected;
        public event Action<GunDefinition> GunChanged;
        public event Action<int, int> AmmoChanged;

        private int[] roundsLoaded;
        private int[] reserveRounds;
        private int selected;
        private float nextShotTime;
        private Coroutine reloading;
        private Coroutine burst;

        public GunDefinition Current => guns != null && guns.Length > 0 && selected < guns.Length ? guns[selected] : null;
        public int LoadedRounds => roundsLoaded != null && Current != null ? roundsLoaded[selected] : 0;
        public int ReserveRounds => reserveRounds != null && Current != null ? reserveRounds[selected] : 0;
        public int SelectedIndex => selected;

        private void Awake()
        {
            if (aimCamera == null) aimCamera = GetComponentInChildren<Camera>();
            if (look == null && aimCamera != null) look = aimCamera.GetComponent<FirstPersonLook>();
            int length = guns == null ? 0 : guns.Length;
            roundsLoaded = new int[length];
            reserveRounds = new int[length];
            for (int i = 0; i < length; i++)
            {
                if (guns[i] == null) continue;
                roundsLoaded[i] = Mathf.Max(1, guns[i].magazineSize);
                reserveRounds[i] = Mathf.Max(0, guns[i].startingReserve);
            }
        }

        private void Start()
        {
            if (Current != null)
            {
                GunChanged?.Invoke(Current);
                BroadcastAmmo();
            }
        }

        private void Update()
        {
            GunDefinition gun = Current;
            if (gun == null || aimCamera == null) return;

            if (Input.GetKeyDown(reloadKey)) StartReload();
            if (Input.GetKeyDown(inspectKey)) Inspected?.Invoke(gun);
            if (Input.GetKeyDown(previousGunKey)) SelectGun((selected - 1 + guns.Length) % guns.Length);
            if (Input.GetKeyDown(nextGunKey)) SelectGun((selected + 1) % guns.Length);
            if (Current != gun) return;
            if (reloading != null || burst != null) return;

            if (gun.fireMode == GunFireMode.Automatic)
            {
                if (Input.GetMouseButton(fireMouseButton)) FireOneShot(gun);
            }
            else if (gun.fireMode == GunFireMode.SemiAutomatic)
            {
                if (Input.GetMouseButtonDown(fireMouseButton)) FireOneShot(gun);
            }
            else if (Input.GetMouseButtonDown(fireMouseButton))
            {
                burst = StartCoroutine(FireBurst(gun));
            }
        }

        public bool SelectGun(int index)
        {
            if (guns == null || index < 0 || index >= guns.Length || guns[index] == null) return false;
            if (selected == index) return true;
            CancelActions();
            selected = index;
            nextShotTime = Time.time;
            GunChanged?.Invoke(Current);
            BroadcastAmmo();
            return true;
        }

        public void StartReload()
        {
            if (Current == null || reloading != null || burst != null) return;
            if (LoadedRounds >= Current.magazineSize || ReserveRounds <= 0) return;
            reloading = StartCoroutine(Reload(Current, selected));
        }

        public void Inspect()
        {
            if (Current != null) Inspected?.Invoke(Current);
        }

        private bool FireOneShot(GunDefinition gun)
        {
            if (Time.time < nextShotTime || reloading != null) return false;
            if (LoadedRounds <= 0) { StartReload(); return false; }

            roundsLoaded[selected]--;
            nextShotTime = Time.time + 1f / Mathf.Max(0.1f, gun.roundsPerSecond);
            Fired?.Invoke(gun);
            BroadcastAmmo();
            if (look != null)
                look.AddRecoil(UnityEngine.Random.Range(-gun.recoilHorizontal, gun.recoilHorizontal), gun.recoilVertical);

            for (int p = 0; p < Mathf.Max(1, gun.pelletsPerShot); p++)
            {
                Vector3 dir = aimCamera.transform.forward;
                if (gun.spreadDegrees > 0f)
                {
                    Vector2 spread = UnityEngine.Random.insideUnitCircle * gun.spreadDegrees;
                    dir = Quaternion.AngleAxis(spread.x, aimCamera.transform.up) *
                          Quaternion.AngleAxis(spread.y, aimCamera.transform.right) * dir;
                }
                if (Physics.Raycast(aimCamera.transform.position, dir, out RaycastHit hit,
                    gun.rayDistance, hitLayers, QueryTriggerInteraction.Ignore))
                    RayHit?.Invoke(gun, hit);
            }
            return true;
        }

        private IEnumerator FireBurst(GunDefinition gun)
        {
            int shots = Mathf.Max(1, gun.burstSize);
            for (int n = 0; n < shots; n++)
            {
                // Time gating is shared with semi/auto fire.
                while (Time.time < nextShotTime) yield return null;
                if (Current != gun || LoadedRounds <= 0) break;
                FireOneShot(gun);
                yield return null;
            }
            burst = null;
        }

        private IEnumerator Reload(GunDefinition gun, int index)
        {
            ReloadStarted?.Invoke(gun);
            yield return new WaitForSeconds(Mathf.Max(0.05f, gun.reloadSeconds));
            if (Current == gun && selected == index)
            {
                int needed = Mathf.Max(0, gun.magazineSize - roundsLoaded[index]);
                int moved = Mathf.Min(needed, reserveRounds[index]);
                roundsLoaded[index] += moved;
                reserveRounds[index] -= moved;
                ReloadCompleted?.Invoke(gun);
                BroadcastAmmo();
            }
            reloading = null;
        }

        private void CancelActions()
        {
            if (reloading != null) { StopCoroutine(reloading); reloading = null; }
            if (burst != null) { StopCoroutine(burst); burst = null; }
        }

        private void OnDisable() => CancelActions();

        private void BroadcastAmmo() => AmmoChanged?.Invoke(LoadedRounds, ReserveRounds);
    }
}
