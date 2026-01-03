struct Uniforms {
    ndcMat : mat4x4f,
    projMat : mat4x4f,
    transMat : mat4x4f,
    rotMat : mat4x4f,
};


struct VertexShaderOutput {
    @builtin(position) position: vec4f,
    @location(0) color1 : vec4f,
    @location(1) color2 : vec4f,
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;

@vertex fn vs(
    @location(0) pos : vec3f,
    @location(1) col1: vec4f,   // per instance
    @location(2) col2: vec4f,   // per instance
    @location(3) offset: vec2f, // per instance
    @location(4) scale: vec2f,  // per instance
) -> VertexShaderOutput {

    let hPos =   uniforms.ndcMat * uniforms.projMat * uniforms.transMat * vec4f(pos, 1.0);

    var vsOut: VertexShaderOutput;

    vsOut.position = hPos;
    vsOut.color1 = col1;
    vsOut.color2 = col2;

    return vsOut;
}