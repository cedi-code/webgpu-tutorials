struct VertexOutput {
    @builtin(position) pos: vec4f,
    @location(0) uv: vec2f,
};

@group(0) @binding(0) var mySampler: sampler;
@group(0) @binding(1) var myTexture: texture_2d<f32>;

@fragment fn fs(input: VertexOutput) -> @location(0) vec4f {

    return textureSample(myTexture, mySampler, input.uv);
}