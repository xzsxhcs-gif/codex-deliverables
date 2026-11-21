using UnityEngine;

namespace Summit17 {
    // Optional desktop visitor. Disable the entire Desktop Visitor root when installing an XR rig.
    [RequireComponent(typeof(CharacterController))]
    public sealed class StationWalkthrough : MonoBehaviour {
        public Camera eyes;
        private CharacterController body;
        private float elevation, fall;
        void Awake() { body = GetComponent<CharacterController>(); }
        void Update() {
            if (!eyes) return;
            if (Input.GetMouseButtonDown(0)) Cursor.lockState = CursorLockMode.Locked;
            if (Input.GetKeyDown(KeyCode.Escape)) Cursor.lockState = CursorLockMode.None;
            if (Cursor.lockState == CursorLockMode.Locked) {
                transform.Rotate(0, Input.GetAxisRaw("Mouse X") * 1.7f, 0);
                elevation = Mathf.Clamp(elevation - Input.GetAxisRaw("Mouse Y") * 1.7f, -82f, 82f);
                eyes.transform.localRotation = Quaternion.Euler(elevation, 0, 0);
            }
            float sideways = (Input.GetKey(KeyCode.D)?1:0) - (Input.GetKey(KeyCode.A)?1:0);
            float forward = (Input.GetKey(KeyCode.W)?1:0) - (Input.GetKey(KeyCode.S)?1:0);
            var move = Vector3.ClampMagnitude(transform.right*sideways + transform.forward*forward,1);
            fall = body.isGrounded ? -1.5f : Mathf.Max(-12,fall - 15*Time.deltaTime);
            body.Move((move * (Input.GetKey(KeyCode.LeftShift)?2.6f:1.65f) + Vector3.up*fall)*Time.deltaTime);
        }
        void OnDisable() { Cursor.lockState = CursorLockMode.None; }
    }
}
