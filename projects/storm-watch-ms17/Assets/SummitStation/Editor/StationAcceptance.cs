using System;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Summit17.Editor {
    public static class StationAcceptance {
        const string ScenePath = "Assets/SummitStation/Scenes/StormWatch.unity";

        [MenuItem("Summit 17/Open Storm Watch")]
        public static void Open() {
            if (EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())
                EditorSceneManager.OpenScene(ScenePath);
        }

        [MenuItem("Summit 17/Check open station")]
        public static void CheckOpenScene() {
            var scene = UnityEngine.SceneManagement.SceneManager.GetActiveScene();
            if (scene.path != ScenePath)
                throw new InvalidOperationException("Open StormWatch.unity before validating.");
            var objects = scene.GetRootGameObjects()
                .SelectMany(root => root.GetComponentsInChildren<Transform>(true)).ToArray();
            foreach (var obj in objects) {
                if (GameObjectUtility.GetMonoBehavioursWithMissingScriptCount(obj.gameObject) != 0)
                    throw new InvalidOperationException("Missing script on " + obj.name);
            }
            var filters = objects.Select(obj => obj.GetComponent<MeshFilter>()).Where(f => f).ToArray();
            foreach (var filter in filters) {
                var mesh = filter.sharedMesh;
                var renderer = filter.GetComponent<Renderer>();
                if (!mesh || mesh.vertexCount == 0 || !renderer || !renderer.sharedMaterial ||
                    !renderer.sharedMaterial.shader || !renderer.sharedMaterial.shader.isSupported)
                    throw new InvalidOperationException("Mesh/material import failed on " + filter.name);
            }
            var weather = UnityEngine.Object.FindObjectOfType<SummitWeather>();
            if (!weather || !weather.wind || !weather.rain || !weather.thunder ||
                !weather.ventilation || !weather.engine || !weather.stormLight || !weather.rainMaterial)
                throw new InvalidOperationException("Missing weather or ambience binding.");
            if (filters.Length < 100 || !Camera.main)
                throw new InvalidOperationException("Incomplete scene or camera binding.");
            Debug.Log("MS-17 import verified. Mesh filters: " + filters.Length +
                ". Interaction sockets: " + UnityEngine.Object.FindObjectsOfType<StationSocket>().Length);
        }

        // Unity -batchmode -projectPath <path> -executeMethod Summit17.Editor.StationAcceptance.Batch -quit
        public static void Batch() {
            EditorSceneManager.OpenScene(ScenePath);
            CheckOpenScene();
        }
    }
}
