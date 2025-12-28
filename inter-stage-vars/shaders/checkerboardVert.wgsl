struct UniformsScale {
    triangleScale: vec2f
};

struct UniformStatic {
    color1: vec4f,
    color2: vec4f,
    offset: vec2f,
    scale: vec2f,
};

@group(0) @binding(0) var<uniform> uniformStatic : UniformStatic;
@group(0) @binding(1) var<uniform> uniformsScale : UniformsScale;

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

    let posWorld = pos[vertexIndex] * uniformStatic.scale * uniformsScale.triangleScale + uniformStatic.offset;

    vsOut.position = vec4f(posWorld, 0.0, 1.0); 
    
    return vsOut;
}