struct UniformGrid {
    gridScale: u32,
};

struct UniformStatic {
    color1: vec4f,
    color2: vec4f,
    offset: vec2f,
scale: vec2f,
};

@group(0) @binding(0) var<uniform> uniformStatic : UniformStatic;
@group(0) @binding(2) var<uniform> uniformsGrid : UniformGrid;

@fragment fn fs(@builtin(position) pixelPos : vec4f) -> @location(0) vec4f {
    let red = uniformStatic.color1;
    let green = uniformStatic.color2;

    let grid = vec2u(pixelPos.xy) / uniformsGrid.gridScale;
    let checker = (grid.x + grid.y) % 2 == 1;
    return select(red, green, checker);
}