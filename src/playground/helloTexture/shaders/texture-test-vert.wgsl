struct VertexOutput {
    @builtin(position) pos: vec4f,
    @location(0) uv: vec2f,
};

@vertex fn vs(
    @location(0) pos: vec3f,
    @location(1) uv: vec2f,
) -> VertexOutput {

    var vsOut : VertexOutput;

    vsOut.pos = vec4f(pos,1.0);
    vsOut.uv = uv;

    return vsOut;
}