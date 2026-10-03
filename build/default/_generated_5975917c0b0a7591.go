components {
  id: "script"
  component: "/main/cloud.script"
}
embedded_components {
  id: "c1"
  type: "model"
  data: "mesh: \"/assets/meshes/sphere_cloud_a.gltf\"\nmaterial: \"/assets/materials/chibi.material\"\n"
}
embedded_components {
  id: "c2"
  type: "model"
  data: "mesh: \"/assets/meshes/sphere_cloud_b.gltf\"\nmaterial: \"/assets/materials/chibi.material\"\n"
  position {
    x: -1.1
    y: -0.1
    z: 0.15
  }
}
embedded_components {
  id: "c3"
  type: "model"
  data: "mesh: \"/assets/meshes/sphere_cloud_c.gltf\"\nmaterial: \"/assets/materials/chibi.material\"\n"
  position {
    x: 1.15
    y: -0.12
    z: -0.1
  }
}
embedded_components {
  id: "c4"
  type: "model"
  data: "mesh: \"/assets/meshes/sphere_cloud.gltf\"\nmaterial: \"/assets/materials/chibi.material\"\n"
  position {
    x: 0.3
    y: 0.25
    z: 0.3
  }
}
