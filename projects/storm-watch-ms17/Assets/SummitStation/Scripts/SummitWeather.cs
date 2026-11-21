using UnityEngine;
namespace Summit17 {
    public sealed class SummitWeather : MonoBehaviour {
        public Light stormLight;
        public Material rainMaterial;
        public AudioClip wind, rain, thunder, ventilation, engine;
        [Range(0,1)] public float lightningStrength = .48f;
        [Range(0,1)] public float soundLevel = .78f;
        private AudioSource windBed, rainBed, roomBed, engineBed, thunderSource;
        private ParticleSystem drops;
        private readonly System.Random weather = new System.Random(1704);
        private Camera observer;
        private float time, nextFlash = 16, flashTime = -20, thunderAt = -1, fraction;
        private float Sample() {return (float)weather.NextDouble();}
        private AudioSource Source(string label, AudioClip clip, bool spatial, bool loop, Vector3 location) {
            var emitter = new GameObject(label);
            emitter.transform.SetParent(transform, false); emitter.transform.position = location;
            var source = emitter.AddComponent<AudioSource>();
            source.clip = clip; source.spatialBlend = spatial ? 1:0;
            source.rolloffMode = AudioRolloffMode.Logarithmic; source.minDistance = 1.5f; source.maxDistance = 24;
            source.playOnAwake = false; source.loop = loop; source.volume = 0;
            if (clip && loop) source.Play(); return source;
        }
        void Start() {
            windBed=Source("Ridge wind",wind,false,true,Vector3.zero);
            rainBed=Source("Rain on roof",rain,false,true,Vector3.zero);
            roomBed=Source("Control rack fan",ventilation,true,true,new Vector3(-9,1.2f,2));
            engineBed=Source("Standby plant ventilation",engine,true,true,new Vector3(27,1,0));
            thunderSource=Source("Distant thunder",thunder,false,false,Vector3.zero);
            var emitter=new GameObject("Wind-driven rain");emitter.transform.SetParent(transform,false);
            drops=emitter.AddComponent<ParticleSystem>();drops.Stop(true,ParticleSystemStopBehavior.StopEmittingAndClear);
            var main=drops.main; main.simulationSpace=ParticleSystemSimulationSpace.World; main.maxParticles=950;
            main.startLifetime=1.4f; main.startSize=.025f; main.startSpeed=0;main.playOnAwake=false;
            var emission=drops.emission;emission.enabled=false;var shape=drops.shape;shape.enabled=false;
            var renderer=drops.GetComponent<ParticleSystemRenderer>();renderer.renderMode=ParticleSystemRenderMode.Stretch;
            renderer.velocityScale=.035f;renderer.lengthScale=1.8f;renderer.sharedMaterial=rainMaterial;
            renderer.shadowCastingMode=UnityEngine.Rendering.ShadowCastingMode.Off;renderer.receiveShadows=false;
            drops.Play();
        }
        static bool UnderRoof(float x,float z) {
            return (x>=-10.2f&&x<=6.8f&&z>=-3&&z<=7.7f) || (x>=21.8f&&x<=30.2f&&z>=-4.4f&&z<=3);
        }
        void Update() {
            if(!observer || !observer.isActiveAndEnabled) observer=Camera.main;
            if(!observer) return;
            time+=Time.deltaTime;
            var eye=observer.transform.position; bool interior=UnderRoof(eye.x,eye.z)&&eye.y<3.6f;
            float gust=.5f+.5f*Mathf.Sin(time*.126f+Mathf.Sin(time*.066f));
            RenderSettings.fogDensity=.012f+gust*.010f;
            if(time>=nextFlash) {flashTime=time;nextFlash=time+19+Sample()*26;thunderAt=time+1.8f+Sample()*2.4f;}
            float since=time-flashTime;
            float flash=(Mathf.Exp(-since*9)+.36f*Mathf.Exp(-Mathf.Abs(since-.29f)*13))*lightningStrength;
            if(stormLight)stormLight.intensity=.43f+flash*2.2f;
            Shader.SetGlobalFloat("_SummitFlash",flash);
            if(thunderAt>0&&time>=thunderAt){thunderSource.volume=soundLevel*(interior ? .24f : .54f);thunderSource.Play();thunderAt=-1;}
            windBed.volume=Mathf.Lerp(windBed.volume,soundLevel*(interior ? .10f : .39f)*(.7f+.3f*gust),Time.deltaTime*2);
            rainBed.volume=Mathf.Lerp(rainBed.volume,soundLevel*(interior ? .14f : .42f),Time.deltaTime*2);
            roomBed.volume=.34f*soundLevel;engineBed.volume=.24f*soundLevel;
            // Reject trajectories crossing either roof footprint before they reach eye height.
            fraction+=Mathf.Min(Time.deltaTime,.1f)*590;
            int count=(int)fraction;fraction-=count;
            for(int i=0;i<count;i++){
                float x=eye.x+(Sample()-.5f)*34,z=eye.z+(Sample()-.5f)*34,y=eye.y+2+Sample()*9;
                float dx=2.2f+gust*1.1f,life=Mathf.Clamp((y+.65f)/10,0,1.5f);
                if(UnderRoof(x,z)||UnderRoof(x+dx*life*.5f,z+.2f)||UnderRoof(x+dx*life,z+.4f))continue;
                var drop=new ParticleSystem.EmitParams{position=new Vector3(x,y,z),velocity=new Vector3(dx,-10,.4f),startLifetime=life,startSize=.019f+Sample()*.014f};
                drops.Emit(drop,1);
            }
        }
        void OnDisable(){ Shader.SetGlobalFloat("_SummitFlash",0); }
    }
}
