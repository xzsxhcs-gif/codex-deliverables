using UnityEngine;
namespace Summit17 {
    // Local origin is the hinge, slide datum, grip or service connection.
    public sealed class StationSocket : MonoBehaviour {
        public string role;
        public Vector3 localAxis;
        public float travel;
    }
}
