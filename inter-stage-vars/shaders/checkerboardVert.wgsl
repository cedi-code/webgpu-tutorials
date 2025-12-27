struct Uniforms {
    gridScale: u32,
    triangleScale: vec2f
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;

struct VertexShaderOutput {
    @builtin(position) position: vec4f,
};

@vertex fn vs(
    @builtin(vertex_index) vertexIndex : u32
) -> VertexShaderOutput {
    let pos = array(
        vec2f(0.0, 0.5), // top
        vec2f(-0.5, -0.5), // left
        vec2f(0.5, -0.5) // right
    );

    var vsOut: VertexShaderOutput;

    vsOut.position = vec4f(pos[vertexIndex] * uniforms.triangleScale, 0.0, 1.0); 
    
    return vsOut;
}