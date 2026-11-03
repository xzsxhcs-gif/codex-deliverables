using UnityEngine;

namespace ActionWeaponKit.Movement
{
    /// <summary>First-person camera look and camera-only recoil. No scene, mesh or game rules.</summary>
    [DisallowMultipleComponent]
    public sealed class FirstPersonLook : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private Transform yawBody;

        [Header("Mouse")]
        [SerializeField, Min(0.01f)] private float sensitivity = 2.0f;
        [SerializeField] private float minPitch = -85f;
        [SerializeField] private float maxPitch = 85f;
        [SerializeField] private bool lockCursorOnStart = true;

        [Header("Recoil recovery")]
        [SerializeField, Min(0.01f)] private float recoilKickSpeed = 25f;
        [SerializeField, Min(0.01f)] private float recoilRecoverySpeed = 10f;

        private float pitch;
        private Vector2 pendingRecoil;
        private Vector2 appliedRecoil;

        private void Awake()
        {
            if (yawBody == null && transform.parent != null) yawBody = transform.parent;
            pitch = NormalizePitch(transform.localEulerAngles.x);
            if (lockCursorOnStart) LockCursor(true);
        }

        private void Update()
        {
            if (yawBody == null) return;
            if (Cursor.lockState != CursorLockMode.Locked) return;

            float dx = Input.GetAxisRaw("Mouse X") * sensitivity;
            float dy = Input.GetAxisRaw("Mouse Y") * sensitivity;
            yawBody.Rotate(0f, dx, 0f, Space.Self);
            pitch = Mathf.Clamp(pitch - dy, minPitch, maxPitch);
        }

        private void LateUpdate()
        {
            // Apply recoil as a temporary camera offset, not to the permanent look pitch.
            pendingRecoil = Vector2.Lerp(pendingRecoil, Vector2.zero, recoilRecoverySpeed * Time.deltaTime);
            appliedRecoil = Vector2.Lerp(appliedRecoil, pendingRecoil, recoilKickSpeed * Time.deltaTime);
            transform.localRotation = Quaternion.Euler(
                Mathf.Clamp(pitch - appliedRecoil.y, minPitch, maxPitch),
                appliedRecoil.x, 0f);
        }

        /// <param name="horizontal">Horizontal visual kick, in degrees.</param>
        /// <param name="vertical">Upward visual kick, in degrees.</param>
        public void AddRecoil(float horizontal, float vertical)
        {
            pendingRecoil += new Vector2(horizontal, vertical);
        }

        public static void LockCursor(bool locked)
        {
            Cursor.lockState = locked ? CursorLockMode.Locked : CursorLockMode.None;
            Cursor.visible = !locked;
        }

        private static float NormalizePitch(float angle) => angle > 180f ? angle - 360f : angle;
    }
}
