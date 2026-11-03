using UnityEngine;

namespace ActionWeaponKit.Weapons
{
    public enum GunFireMode { SemiAutomatic, Automatic, Burst }

    /// <summary>Data-only gun settings; no model or game economy.</summary>
    [CreateAssetMenu(fileName = "Gun", menuName = "Action Weapon Kit/Gun Definition")]
    public sealed class GunDefinition : ScriptableObject
    {
        public string displayName = "Gun";
        public GunFireMode fireMode = GunFireMode.Automatic;
        [Min(1)] public int magazineSize = 30;
        [Min(0)] public int startingReserve = 90;
        [Min(0.1f)] public float roundsPerSecond = 10f;
        [Min(0.05f)] public float reloadSeconds = 1.7f;
        [Min(0.1f)] public float rayDistance = 150f;
        [Min(1)] public int pelletsPerShot = 1;
        [Range(0f, 10f)] public float spreadDegrees = 0.5f;
        [Min(1)] public int burstSize = 3;
        [Range(0f, 10f)] public float recoilVertical = 1.5f;
        [Range(0f, 10f)] public float recoilHorizontal = 0.45f;
    }
}
