Shader "Summit17/Rain" {SubShader{Tags{"Queue"="Transparent" "RenderType"="Transparent"} Blend SrcAlpha OneMinusSrcAlpha Cull Off ZWrite Off
Pass {
CGPROGRAM
#pragma target 3.0
   #pragma vertex vert
#pragma fragment frag
#pragma multi_compile_instancing
#include "UnityCG.cginc"
struct a{float4 vertex:POSITION;float2 uv:TEXCOORD0; UNITY_VERTEX_INPUT_INSTANCE_ID};struct v{float4 pos:SV_POSITION;float2 uv:TEXCOORD0; UNITY_VERTEX_OUTPUT_STEREO};
v vert(a i){v o;UNITY_SETUP_INSTANCE_ID(i);UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(o);o.pos=UnityObjectToClipPos(i.vertex);o.uv=i.uv;return o;}
fixed4 frag(v i):SV_Target{float2 f=1-abs(i.uv*2-1);return fixed4(.48,.60,.67,.36*saturate(f.x)*saturate(f.y));}
ENDCG
}
}
}
