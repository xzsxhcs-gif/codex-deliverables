using UnityEngine;

namespace ActionWeaponKit.Weapons
{
    /// <summary>
    /// Optional procedural sway and inspect motion for a user-provided gun pivot.
    /// It has no model, materials, sprites, particles, or audio dependencies.
    /// </summary>
    public sealed class GunMotion : MonoBehaviour
    {
        [SerializeField] private GunController gunController;
        [SerializeField] private Transform weaponPivot;
        [SerializeField, Range(0f, 0.1f)] private float swayPosition = 0.008f;
        [SerializeField, Range(0f, 10f)] private float swayRotation = 1.7f;
        [SerializeField, Min(0.1f)] private float smoothing = 14f;
        [SerializeField, Min(0.1f)] private float inspectSeconds = 1.4f;

        private Vector3 startingPosition;
        private Quaternion startingRotation;
        private float inspectTimeRemaining;

        private void Awake()
        {
            if (weaponPivot == null) weaponPivot = transform;
            startingPosition = weaponPivot.localPosition;
            startingRotation = weaponPivot.localRotation;
            if (gunController == null) gunController = GetComponentInParent<GunController>();
        }

        private void OnEnable()
        {
            if (gunController != null) gunController.Inspected += HandleInspect;
        }

        private void OnDisable()
        {
            if (gunController != null) gunController.Inspected -= HandleInspect;
        }

        private void HandleInspect(GunDefinition _) => inspectTimeRemaining = inspectSeconds;

        private void LateUpdate()
        {
            if (weaponPivot == null) return;
            float x = Cursor.lockState == CursorLockMode.Locked ? Input.GetAxisRaw("Mouse X") : 0f;
            float y = Cursor.lockState == CursorLockMode.Locked ? Input.GetAxisRaw("Mouse Y") : 0f;
            float inspectAngle = 0f;
            if (inspectTimeRemaining > 0f)
            {
                inspectTimeRemaining = Mathf.Max(0f, inspectTimeRemaining - Time.deltaTime);
                float progress = 1f - inspectTimeRemaining / inspectSeconds;
                inspectAngle = Mathf.Sin(progress * Mathf.PI) * 65f;
            }
            Vector3 pos = startingPosition + new Vector3(-x * swayPosition, -y * swayPosition, 0f);
            Quaternion rotation = startingRotation * Quaternion.Euler(-y * swayRotation, -x * swayRotation + inspectAngle, x * swayRotation * 0.3f);
            float factor = 1f - Mathf.Exp(-smoothing * Time.deltaTime);
            weaponPivot.localPosition = Vector3.Lerp(weaponPivot.localPosition, pos, factor);
            weaponPivot.localRotation = Quaternion.Slerp(weaponPivot.localRotation, rotation, factor);
        }
    }
}
