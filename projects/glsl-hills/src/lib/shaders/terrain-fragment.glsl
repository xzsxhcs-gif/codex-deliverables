precision highp float;

uniform vec3 uBaseColor;
uniform vec3 uPeakColor;
uniform vec3 uKeyColor;
uniform vec3 uFillColor;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uPlaneSize;

varying vec3 vWorldPosition;
varying vec3 vSmoothNormal;
varying vec2 vLocalXZ;
varying float vHeight;

void main() {
  vec3 normal = normalize(vSmoothNormal);
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
  vec3 keyDirection = normalize(vec3(-0.55, 0.82, 0.40));
  vec3 fillDirection = normalize(vec3(0.65, 0.35, -0.55));
  vec3 halfDirection = normalize(keyDirection + viewDirection);

  float keyDiffuse = max(dot(normal, keyDirection), 0.0);
  float fillDiffuse = max(dot(normal, fillDirection), 0.0);
  float hemisphere = 0.45 + 0.55 * max(normal.y, 0.0);
  float elevation = smoothstep(-10.0, 12.0, vHeight);
  float valleyShade = mix(0.76, 1.0, smoothstep(-10.0, 9.0, vHeight));
  vec3 albedo = mix(uBaseColor, uPeakColor, elevation);
  vec3 illumination = uKeyColor * (0.12 + 0.82 * keyDiffuse)
    + uFillColor * (0.55 + 0.30 * fillDiffuse + 0.20 * hemisphere);
  vec3 color = albedo * illumination * valleyShade;

  float specular = 0.12 * pow(max(dot(normal, halfDirection), 0.0), 28.0)
    * smoothstep(0.0, 0.25, keyDiffuse);
  float grazing = 0.025 * pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.0)
    * smoothstep(0.20, 0.85, normal.y);
  color += uKeyColor * (specular + grazing);

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>

  float distanceToCamera = length(cameraPosition - vWorldPosition);
  float fogDistance = max(distanceToCamera - 35.0, 0.0);
  float fogAmount = 1.0 - exp(-fogDistance * fogDistance
    * uFogDensity * uFogDensity);
  float halfExtent = 0.5 * max(uPlaneSize, 1.0);
  float edgeDistance = halfExtent - max(abs(vLocalXZ.x), abs(vLocalXZ.y));
  float edgeVisibility = smoothstep(0.0, max(uPlaneSize * 0.115, 0.01), edgeDistance);
  // Clear color is not tone-mapped. Mix haze in the same linear output space
  // after tone mapping so distant edges meet the background without a dark rim.
  gl_FragColor.rgb = mix(uFogColor, gl_FragColor.rgb, (1.0 - fogAmount) * edgeVisibility);
  #include <colorspace_fragment>
}

