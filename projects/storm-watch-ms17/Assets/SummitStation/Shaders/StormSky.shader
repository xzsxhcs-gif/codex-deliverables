Shader "Summit17/Ridge squall" {
SubShader { Tags {"Queue"="Background" "RenderType"="Background" "PreviewType"="Skybox"} Cull Off ZWrite Off
Pass {
CGPROGRAM
#pragma target 3.0
   #pragma vertex vert
#pragma fragment frag
#pragma multi_compile_instancing
#include "UnityCG.cginc"
struct app {float4 vertex:POSITION; UNITY_VERTEX_INPUT_INSTANCE_ID};
struct vary {float4 pos:SV_POSITION;float3 dir:TEXCOORD0; UNITY_VERTEX_OUTPUT_STEREO};
vary vert(app v){vary o;UNITY_SETUP_INSTANCE_ID(v);UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(o);o.pos=UnityObjectToClipPos(v.vertex);o.dir=v.vertex.xyz;return o;}
float hash(float2 p){return frac(sin(dot(p,float2(26.73,97.31)))*17613.314);}
float ridgeNoise(float2 p){float2 u=frac(p);u=u*u*(3-2*u);p=floor(p);return lerp(lerp(hash(p),hash(p+float2(1,0)),u.x),lerp(hash(p+float2(0,1)),hash(p+1),u.x),u.y);}
float _SummitFlash;
float4 frag(vary i):SV_Target {float3 d=normalize(i.dir);float2 p=d.xz/(.17+max(0,d.y))*.9;p.x+=_Time.y*.011;float n=.56*ridgeNoise(p)+.28*ridgeNoise(p*2.05)+.16*ridgeNoise(p*4.2);
float h=pow(1-saturate(d.y),3);float3 color=lerp(float3(.023,.035,.057),float3(.105,.15,.19),h)*(.47+.78*n);
return float4(color+_SummitFlash*float3(.39,.46,.56)*(.36+n),1);}
ENDCG
}
}
}
