using System;
using UnityEngine;

namespace ActionWeaponKit.Movement
{
    public enum ParkourState
    {
        Grounded, Airborne, Sliding, WallRunning, Vaulting, LedgeHanging, LedgeClimbing
    }

    /// <summary>
    /// Standalone CharacterController-based movement: walk, sprint, jump, air control,
    /// slide, wall-run, wall-kick, simple vault and ledge grab/climb.
    /// Requires the host project to supply a CharacterController and collision geometry.
    /// </summary>
    [RequireComponent(typeof(CharacterController))]
    [DisallowMultipleComponent]
    public sealed class ParkourMotor : MonoBehaviour
    {
        [Header("Input")]
        [SerializeField] private KeyCode jumpKey = KeyCode.Space;
        [SerializeField] private KeyCode sprintKey = KeyCode.LeftShift;
        [SerializeField] private KeyCode crouchKey = KeyCode.LeftControl;

        [Header("Ground movement")]
        [SerializeField, Min(0.1f)] private float walkSpeed = 5.8f;
        [SerializeField, Min(0.1f)] private float sprintSpeed = 9.5f;
        [SerializeField, Min(0.1f)] private float crouchSpeed = 3.2f;
        [SerializeField, Min(0.1f)] private float groundAcceleration = 34f;
        [SerializeField, Min(0.1f)] private float airAcceleration = 12f;
        [SerializeField, Min(0.1f)] private float jumpHeight = 1.4f;
        [SerializeField, Min(0.1f)] private float gravity = 24f;
        [SerializeField, Min(0f)] private float coyoteTime = 0.1f;
        [SerializeField, Min(0f)] private float jumpBuffer = 0.12f;

        [Header("Slide and crouch")]
        [SerializeField, Range(0.4f, 1f)] private float crouchHeightRatio = 0.6f;
        [SerializeField, Min(0.1f)] private float capsuleResizeSpeed = 6f;
        [SerializeField, Min(0.1f)] private float slideStartSpeed = 6.0f;
        [SerializeField, Min(0.1f)] private float slideDrag = 3.5f;
        [SerializeField, Min(0.1f)] private float slideDuration = 0.85f;

        [Header("Wall actions")]
        [SerializeField] private LayerMask parkourLayers = ~0;
        [SerializeField, Min(0.1f)] private float wallReach = 0.75f;
        [SerializeField, Min(0.1f)] private float wallRunMinSpeed = 4.5f;
        [SerializeField, Min(0.1f)] private float wallRunSpeed = 8.5f;
        [SerializeField, Min(0.1f)] private float wallRunMaxTime = 1.2f;
        [SerializeField, Min(0.1f)] private float wallFallSpeed = 2.5f;
        [SerializeField, Min(0.1f)] private float wallKickAwaySpeed = 6.5f;
        [SerializeField, Min(0.1f)] private float wallKickUpSpeed = 7f;
        [SerializeField, Min(0.01f)] private float wallReuseCooldown = 0.35f;

        [Header("Vault and ledge")]
        [SerializeField, Min(0.1f)] private float vaultReach = 1.1f;
        [SerializeField, Min(0.1f)] private float maxVaultHeight = 1.2f;
        [SerializeField, Min(0.05f)] private float vaultDuration = 0.32f;
        [SerializeField, Min(0.05f)] private float ledgeClimbDuration = 0.38f;

        private CharacterController controller;
        private Vector3 velocity;
        private float lastGroundedTime;
        private float lastJumpPressedTime = float.NegativeInfinity;
        private float slideTimer;
        private float wallTimer;
        private float nextWallAllowed;
        private float standingHeight;
        private float bottomCenterOffset;
        private Vector3 wallNormal;
        private Vector3 traversalStart;
        private Vector3 traversalEnd;
        private Vector3 ledgeStandPoint;
        private float traversalElapsed;
        private float traversalDuration;
        private ParkourState state = ParkourState.Airborne;

        public event Action<ParkourState> StateChanged;
        public ParkourState State => state;
        public Vector3 Velocity => velocity;
        public float HorizontalSpeed => new Vector3(velocity.x, 0f, velocity.z).magnitude;

        private void Reset()
        {
            var cc = GetComponent<CharacterController>();
            if (cc == null) return;
            cc.height = 1.8f;
            cc.center = new Vector3(0f, 0.9f, 0f);
            cc.radius = 0.3f;
        }

        private void Awake()
        {
            controller = GetComponent<CharacterController>();
            standingHeight = controller.height;
            bottomCenterOffset = controller.center.y - controller.height * 0.5f;
        }

        private void Update()
        {
            float dt = Time.deltaTime;
            if (dt <= 0f) return;

            if (Input.GetKeyDown(jumpKey)) lastJumpPressedTime = Time.time;
            if (state == ParkourState.Vaulting || state == ParkourState.LedgeClimbing)
            {
                UpdateTraversal(dt);
                return;
            }
            if (state == ParkourState.LedgeHanging)
            {
                if (Input.GetKeyDown(jumpKey)) BeginTraversal(ParkourState.LedgeClimbing, ledgeStandPoint, ledgeClimbDuration);
                else if (Input.GetKeyDown(crouchKey))
                {
                    controller.enabled = true;
                    velocity = Vector3.zero;
                    lastJumpPressedTime = float.NegativeInfinity;
                    SetState(ParkourState.Airborne);
                }
                return;
            }

            Vector2 axes = new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical"));
            axes = Vector2.ClampMagnitude(axes, 1f);
            Vector3 input = transform.right * axes.x + transform.forward * axes.y;
            bool grounded = controller.isGrounded;
            bool wantsCrouch = Input.GetKey(crouchKey);
            bool wantsSprint = Input.GetKey(sprintKey) && axes.y > 0.1f && !wantsCrouch;
            bool sliding = state == ParkourState.Sliding;

            if (grounded)
            {
                lastGroundedTime = Time.time;
                wallTimer = 0f;
                if (velocity.y < 0f) velocity.y = -2f;
                if (Input.GetKeyDown(crouchKey) && HorizontalSpeed >= slideStartSpeed)
                {
                    slideTimer = slideDuration;
                    SetState(ParkourState.Sliding);
                    sliding = true;
                }
                if (sliding)
                {
                    slideTimer -= dt;
                    Vector3 flat = new Vector3(velocity.x, 0f, velocity.z);
                    flat = Vector3.MoveTowards(flat, Vector3.zero, slideDrag * dt);
                    flat += input * (airAcceleration * 0.16f * dt);
                    velocity.x = flat.x;
                    velocity.z = flat.z;
                    if (slideTimer <= 0f || HorizontalSpeed < crouchSpeed)
                    {
                        sliding = false;
                        SetState(ParkourState.Grounded);
                    }
                }
                else
                {
                    float speed = wantsCrouch ? crouchSpeed : (wantsSprint ? sprintSpeed : walkSpeed);
                    Accelerate(input * speed, groundAcceleration * dt);
                    SetState(ParkourState.Grounded);
                }
            }
            else
            {
                if (state == ParkourState.Sliding) SetState(ParkourState.Airborne);
                if (state == ParkourState.WallRunning && (Time.time < nextWallAllowed || !FindSideWall(out wallNormal)))
                    SetState(ParkourState.Airborne);

                if (state != ParkourState.WallRunning && Time.time >= nextWallAllowed &&
                    HorizontalSpeed >= wallRunMinSpeed && velocity.y <= 1f &&
                    Input.GetKey(sprintKey) && FindSideWall(out wallNormal))
                {
                    wallTimer = 0f;
                    SetState(ParkourState.WallRunning);
                }
                if (state == ParkourState.WallRunning)
                {
                    wallTimer += dt;
                    if (wallTimer > wallRunMaxTime)
                    {
                        nextWallAllowed = Time.time + wallReuseCooldown;
                        SetState(ParkourState.Airborne);
                    }
                    else
                    {
                        Vector3 tangent = Vector3.ProjectOnPlane(transform.forward, wallNormal).normalized;
                        if (Vector3.Dot(tangent, velocity) < 0f) tangent = -tangent;
                        Accelerate(tangent * wallRunSpeed, airAcceleration * dt * 1.5f);
                        velocity.y = Mathf.Max(velocity.y - gravity * 0.2f * dt, -wallFallSpeed);
                    }
                }
                if (state != ParkourState.WallRunning)
                {
                    Accelerate(input * (Input.GetKey(sprintKey) ? sprintSpeed : walkSpeed), airAcceleration * dt);
                    velocity.y -= gravity * dt;
                    SetState(ParkourState.Airborne);
                }
            }

            bool jumpBuffered = Time.time - lastJumpPressedTime <= jumpBuffer;
            if (jumpBuffered)
            {
                if (state == ParkourState.WallRunning)
                {
                    velocity = wallNormal * wallKickAwaySpeed + transform.forward * (wallKickAwaySpeed * 0.35f);
                    velocity.y = wallKickUpSpeed;
                    nextWallAllowed = Time.time + wallReuseCooldown;
                    lastJumpPressedTime = float.NegativeInfinity;
                    SetState(ParkourState.Airborne);
                }
                else if (grounded && TryVault())
                {
                    lastJumpPressedTime = float.NegativeInfinity;
                    return;
                }
                else if (grounded || Time.time - lastGroundedTime <= coyoteTime)
                {
                    velocity.y = Mathf.Sqrt(2f * gravity * jumpHeight);
                    lastJumpPressedTime = float.NegativeInfinity;
                    lastGroundedTime = float.NegativeInfinity;
                    SetState(ParkourState.Airborne);
                }
            }

            if (!grounded && state == ParkourState.Airborne && velocity.y <= 0f && TryGrabLedge()) return;
            bool lowProfile = wantsCrouch || state == ParkourState.Sliding;
            ResizeCapsule(lowProfile ? standingHeight * crouchHeightRatio : standingHeight, dt);

            CollisionFlags hit = controller.Move(velocity * dt);
            if ((hit & CollisionFlags.Above) != 0 && velocity.y > 0f) velocity.y = 0f;
            if ((hit & CollisionFlags.Below) != 0 && velocity.y < 0f) velocity.y = -2f;
        }

        private void Accelerate(Vector3 target, float step)
        {
            Vector3 flat = new Vector3(velocity.x, 0f, velocity.z);
            flat = Vector3.MoveTowards(flat, target, step);
            velocity.x = flat.x;
            velocity.z = flat.z;
        }

        private void ResizeCapsule(float targetHeight, float dt)
        {
            // Do not stand up through an overhang.
            if (targetHeight > controller.height + 0.01f && !CanFit(targetHeight)) return;
            float h = Mathf.MoveTowards(controller.height, targetHeight, capsuleResizeSpeed * dt);
            controller.height = h;
            Vector3 center = controller.center;
            center.y = bottomCenterOffset + h * 0.5f;
            controller.center = center;
        }

        private bool CanFit(float proposedHeight)
        {
            float radius = controller.radius * 0.95f;
            Vector3 bottom = transform.position + Vector3.up * (bottomCenterOffset + radius);
            Vector3 top = transform.position + Vector3.up * (bottomCenterOffset + proposedHeight - radius);
            // CharacterController may overlap its own prospective standing capsule.
            // Exclude colliders belonging to this player from the clearance test.
            Collider[] touching = Physics.OverlapCapsule(bottom, top, radius, parkourLayers, QueryTriggerInteraction.Ignore);
            foreach (Collider other in touching)
            {
                if (other == controller || other.transform.IsChildOf(transform)) continue;
                return false;
            }
            return true;
        }

        private bool FindSideWall(out Vector3 normal)
        {
            Vector3 origin = transform.position + Vector3.up * 1.05f;
            RaycastHit hit;
            if (Physics.Raycast(origin, transform.right, out hit, wallReach, parkourLayers, QueryTriggerInteraction.Ignore) ||
                Physics.Raycast(origin, -transform.right, out hit, wallReach, parkourLayers, QueryTriggerInteraction.Ignore))
            {
                if (Mathf.Abs(hit.normal.y) < 0.3f) { normal = hit.normal; return true; }
            }
            normal = Vector3.zero;
            return false;
        }

        private bool TryVault()
        {
            Vector3 fwd = transform.forward;
            Vector3 pos = transform.position;
            RaycastHit front, top;
            if (!Physics.Raycast(pos + Vector3.up * 0.75f, fwd, out front, vaultReach, parkourLayers, QueryTriggerInteraction.Ignore)) return false;
            if (Physics.Raycast(pos + Vector3.up * (standingHeight + 0.12f), fwd, vaultReach, parkourLayers, QueryTriggerInteraction.Ignore)) return false;
            Vector3 downFrom = front.point + fwd * 0.5f + Vector3.up * maxVaultHeight;
            if (!Physics.Raycast(downFrom, Vector3.down, out top, maxVaultHeight + 0.5f, parkourLayers, QueryTriggerInteraction.Ignore)) return false;
            float heightDiff = top.point.y - pos.y;
            if (heightDiff < 0.15f || heightDiff > maxVaultHeight || top.normal.y < 0.65f) return false;
            BeginTraversal(ParkourState.Vaulting, top.point + fwd * 0.65f + Vector3.up * 0.05f, vaultDuration);
            return true;
        }

        private bool TryGrabLedge()
        {
            Vector3 pos = transform.position;
            Vector3 fwd = transform.forward;
            RaycastHit wall, top;
            if (!Physics.Raycast(pos + Vector3.up * 1.0f, fwd, out wall, vaultReach, parkourLayers, QueryTriggerInteraction.Ignore)) return false;
            if (wall.normal.y > 0.3f) return false;
            if (Physics.Raycast(pos + Vector3.up * (standingHeight + 0.2f), fwd, vaultReach, parkourLayers, QueryTriggerInteraction.Ignore)) return false;
            if (!Physics.Raycast(wall.point + fwd * 0.35f + Vector3.up * 1.1f, Vector3.down, out top,
                1.5f, parkourLayers, QueryTriggerInteraction.Ignore)) return false;
            if (top.normal.y < 0.65f || top.point.y < pos.y + 0.7f || top.point.y > pos.y + standingHeight + 0.2f) return false;
            ledgeStandPoint = top.point + fwd * 0.65f + Vector3.up * 0.05f;
            velocity = Vector3.zero;
            controller.enabled = false;
            transform.position = top.point - fwd * 0.4f - Vector3.up * (standingHeight - 0.45f);
            lastJumpPressedTime = float.NegativeInfinity;
            SetState(ParkourState.LedgeHanging);
            return true;
        }

        private void BeginTraversal(ParkourState targetState, Vector3 destination, float duration)
        {
            controller.enabled = false;
            traversalStart = transform.position;
            traversalEnd = destination;
            traversalElapsed = 0f;
            traversalDuration = Mathf.Max(0.05f, duration);
            velocity = Vector3.zero;
            SetState(targetState);
        }

        private void UpdateTraversal(float dt)
        {
            traversalElapsed += dt;
            float t = Mathf.Clamp01(traversalElapsed / traversalDuration);
            t = t * t * (3f - 2f * t);
            transform.position = Vector3.Lerp(traversalStart, traversalEnd, t);
            if (traversalElapsed >= traversalDuration)
            {
                controller.enabled = true;
                velocity = Vector3.down * 2f;
                SetState(ParkourState.Airborne);
            }
        }

        private void SetState(ParkourState next)
        {
            if (state == next) return;
            state = next;
            StateChanged?.Invoke(next);
        }
    }
}
