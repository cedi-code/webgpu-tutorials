struct VertexOutput {
    @builtin(position) pos: vec4f,
    @location(0) uv: vec2f,
};

struct UniformTTest {
    scale: f32,
};

@group(0) @binding(0) var mySampler: sampler;
@group(0) @binding(1) var myTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> uniforms : UniformTTest;

@fragment fn fs(input: VertexOutput) -> @location(0) vec4f {

    var x = (uniforms.scale  * input.uv.x) - 0.5*uniforms.scale + 0.5;
    var y = (uniforms.scale * input.uv.y) - 0.5*uniforms.scale + 0.5; 
    return textureSample(myTexture, mySampler, vec2f(x, y));
}