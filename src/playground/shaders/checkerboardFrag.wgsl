struct UniformGrid {
    gridScale: u32,
};

struct VertexShaderOutput {
    @builtin(position) position: vec4f,
    @location(0) color1 : vec4f,
    @location(1) color2 : vec4f,
};

@group(0) @binding(1) var<uniform> uniformsGrid : UniformGrid;

@fragment fn fs(vsOut: VertexShaderOutput) -> @location(0) vec4f {
    let red = vsOut.color1;
    let green = vsOut.color2;

    let grid = vec2u(vsOut.position.xy) / uniformsGrid.gridScale;
    let checker = (grid.x + grid.y) % 2 == 1;
    return select(red, green, checker);
}