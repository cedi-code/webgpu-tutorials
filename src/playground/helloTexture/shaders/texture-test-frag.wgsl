struct VertexOutput {
    @builtin(position) pos: vec4f,
};


@fragment fn fs(vsOut: VertexOutput) -> @location(0) vec4f {

    return vec4f(0.0, 0.0, 1.0, 1.0);
}