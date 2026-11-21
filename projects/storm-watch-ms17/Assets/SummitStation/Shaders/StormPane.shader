Shader "Summit17/Weather glazing" {
 SubShader {
  Tags {"Queue"="Transparent" "RenderType"="Transparent"}
  Blend SrcAlpha OneMinusSrcAlpha
  ZWrite Off
  Pass {
   CGPROGRAM
   #pragma target 3.0
   #pragma vertex vert
   #pragma fragment frag
   #pragma multi_compile_instancing
   #include "UnityCG.cginc"
   struct app {float4 vertex:POSITION;float3 normal:NORMAL; UNITY_VERTEX_INPUT_INSTANCE_ID};
   struct vary {float4 pos:SV_POSITION;float3 world:TEXCOORD0;float3 normal:TEXCOORD1; UNITY_VERTEX_OUTPUT_STEREO};
   vary vert(app v) {
    vary o;UNITY_SETUP_INSTANCE_ID(v);UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(o);
    o.pos=UnityObjectToClipPos(v.vertex);o.world=mul(unity_ObjectToWorld,v.vertex).xyz;
    o.normal=UnityObjectToWorldNormal(v.normal);return o;
   }
   float hash21(float2 p){return frac(sin(dot(p,float2(17.89,73.64)))*14768.43);}
   float _SummitFlash;
   fixed4 frag(vary i):SV_Target {
    UNITY_SETUP_STEREO_EYE_INDEX_POST_VERTEX(i);
    float3 n=normalize(i.normal);float horizontal=abs(n.z)>.5?i.world.x:i.world.z;
    float col=floor(horizontal*47);float rand=hash21(float2(col,2));
    float2 p=float2(horizontal*47+.10*sin(i.world.y*11+rand*9),i.world.y*1.8+_Time.y*(.09+.21*rand)+rand*8);
    float dx=frac(p.x)-.25-.45*rand,dy=frac(p.y)-.5;
    float width=max(.018,fwidth(p.x));float bead=(1-smoothstep(.065,.065+width,abs(dx)))*(1-smoothstep(.007,.055,abs(dy)));
    float trail=(1-smoothstep(.017,.017+width,abs(dx)))*saturate(1-abs(dy-.14)*6.3);
    float fresnel=pow(1-saturate(abs(dot(n,normalize(_WorldSpaceCameraPos-i.world)))),3);
    float rain=bead*.27+trail*.095;
    return fixed4(lerp(float3(.20,.29,.32),float3(.58,.69,.72),saturate(rain*3+_SummitFlash)),.037+.11*fresnel+rain);
   }
   ENDCG
  }
 }
}
