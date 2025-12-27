struct Uniforms {
    gridScale: u32,
    triangleScale: vec2f
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;

@fragment fn fs(@builtin(position) pixelPos : vec4f) -> @location(0) vec4f {
    let red = vec4f(1, 0, 0, 1);
    let green = vec4(0.1, 1, 0.1, 1);

    let grid = vec2u(pixelPos.xy) / uniforms.gridScale;
    let checker = (grid.x + grid.y) % 2 == 1;
    return select(red, green, checker);
}