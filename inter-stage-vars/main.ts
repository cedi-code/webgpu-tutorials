
interface Uniforms {
    bufferSize: GPUBuffer,
    valuesSize: Float32Array<ArrayBuffer>,
    bufferGrid: GPUBuffer,
    valuesGrid: Uint32Array<ArrayBuffer>
}

function render(
    device : GPUDevice, 
    renderPassDescriptor : GPURenderPassDescriptor, 
    pipeline : GPURenderPipeline, 
    context : GPUCanvasContext,
    bindGroup: GPUBindGroup, 
    vertexBuffer: GPUBuffer,
    indexBuffer: GPUBuffer,
    instanceBuffer: GPUBuffer,
    numVert : number,
    numObjects : number
    ) {

    // get current textrure from canvas
    for(let colorAttachment of renderPassDescriptor.colorAttachments) {
        if(!colorAttachment) continue; 
        colorAttachment.view = context.getCurrentTexture().createView();
    }
    const encoder = device.createCommandEncoder({ label: 'my first encoder'});

    // make a render pass
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setVertexBuffer(1, instanceBuffer);
    pass.setIndexBuffer(indexBuffer, 'uint32');
    pass.setBindGroup(0, bindGroup);
    pass.drawIndexed(numVert, numObjects);
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
}

function rand(min : number = 0.0, max : number = 0.0) : number  {
    if(max <= min) {
        return Math.random() * min;
    }
    return Math.random() * (max - min) + min;
}

function writeBuffer(device : GPUDevice, buffer: GPUBuffer, offset: GPUSize64, values : ArrayBuffer) : void {
    device.queue.writeBuffer(buffer, offset, values);
}
async function main() {


    const gpu = navigator.gpu;
    if(!gpu) {
        alert("browser needs WebGPU support");
        return;
    }

    const adapter = await gpu.requestAdapter();
    const device = await adapter?.requestDevice();
    if(!device) {
        alert("browser needs WebGPU support");
        return;
    }

    // get webgpu context from canvas
    const canvas = document.querySelector('canvas');
    if(!canvas) {
        console.error("could not find canvas html element");
        return;
    }

    const context = canvas?.getContext('webgpu');
    if(!context) {
        console.error("could not get webgpu context from canvas");
        return;
    }
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device,
        format: presentationFormat,
    });

    const responseVert = await fetch('./shaders/checkerboardVert.wgsl');
    const shaderCodeVert = await responseVert.text();
    const responseFrag = await fetch('./shaders/checkerboardFrag.wgsl');
    const shaderCodeFrag = await responseFrag.text();

    const vsModule = device.createShaderModule({
        label: 'hardcoded checkerboard triangle vertex shader',
        code:  shaderCodeVert,
    });

    const fsModule = device.createShaderModule({
        label: 'hardcoded checkerboard triangle fragment shader',
        code: shaderCodeFrag,
    })

    const pipeline = device.createRenderPipeline({
        label: 'hardcoded checkerboard triangle',
        layout: 'auto',
        vertex: {
            entryPoint: 'vs',
            module: vsModule,
            buffers: [
                {
                    arrayStride: 2 * 4, // 2 float, 4 bytes
                    stepMode: 'vertex',
                    attributes: [
                        {shaderLocation: 0, offset: 0, format: 'float32x2'}, // pos
                    ],
                },
                {
                    arrayStride: (4 + 4 + 2 + 2) * 4, // 8 floats for colors + 2 for scale and 2 for offset
                    stepMode: 'instance',
                    attributes: [
                        {shaderLocation: 1, offset: 0,  format: 'float32x4'}, // col1
                        {shaderLocation: 2, offset: 16, format: 'float32x4'}, // col2
                        {shaderLocation: 3, offset: 32, format: 'float32x2'}, // scale
                        {shaderLocation: 4, offset: 40, format: 'float32x2'}, // offset
                    ]
                }
            ],
        },
        fragment: {
            entryPoint: 'fs',
            module: fsModule,
            targets: [{ format: presentationFormat }],
        }
    });

    const renderPassDescriptor : GPURenderPassDescriptor= {
        label: 'basic renderpass',
        colorAttachments: [
            {
                clearValue: [0.3, 0.3, 0.3, 1.0],
                loadOp: 'clear',
                storeOp: 'store',
                view: context.getCurrentTexture().createView(),
            },
        ],
    };


    // == UNIFORM STATIC BUFFER SETUP start ==

    /*
    struct UniformsScale {
        triangleScale: vec2f
    };
    */
    const uniformScaleSize = 2; // vec2f 
    const uniformScaleBufferSize = uniformScaleSize * 4;
    /*
    struct UniformGrid {
        gridScale: u32,
    };
    */
    const uniformGridSize = 1; // u32 
    const uniformGridBufferSize = 4 * uniformGridSize;

    // buffer
    const uniformBufferScale = device.createBuffer({
        label: 'Uniform Scale Buffer',
        size: uniformScaleBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // values
    const uniformScaleValues = new Float32Array(uniformScaleSize);
    uniformScaleValues[0] = 1.0;
    uniformScaleValues[1] = 1.0;

    device.queue.writeBuffer(uniformBufferScale, 0, uniformScaleValues);

    // buffer
    const uniformBufferGrid = device.createBuffer({
        label: 'Uniform Grid Buffer',
        size: uniformGridBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // values
    const uniformGridValues = new Uint32Array(uniformGridSize);
    uniformGridValues[0] = 8;
    device.queue.writeBuffer(uniformBufferGrid, 0, uniformGridValues);

    const uniforms : Uniforms = {            
        bufferSize: uniformBufferScale,
        valuesSize: uniformScaleValues,
        bufferGrid: uniformBufferGrid,
        valuesGrid: uniformGridValues
    };

    // == UNIFORM BUFFER SETUP end ==

    const numObjects = 30;
    /*
    struct VertexData {
        pos: vec2f
        color1: vec4f,
        color2: vec4f,
        offset: vec2f,
        objscale: vec2f,
    };
    */
    const instanceVertexUnitSize = 
        4 + // color 1
        4 + // color 2
        2 + // offset
        2; // objscale
    const staticUnitBufferSize = instanceVertexUnitSize * 4; // since 32 bits are 4 bytes
    console.log(` instance unit Buffer Size: ${staticUnitBufferSize} bytes`);

    const instanceVertexBufferSize = staticUnitBufferSize * numObjects;
    const instanceVertexSize = instanceVertexUnitSize * numObjects;

    // buffer
    const instanceBuffer = device.createBuffer({
        label: 'vertex Buffer instance objects',
        size: instanceVertexBufferSize,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // values
    const instanceValues = new Float32Array(instanceVertexSize);

    for(let i : number = 0; i < numObjects; ++i) {

        const currIndex : number = instanceVertexUnitSize * i;
        // values
        const kColor1Offset = currIndex + 0;
        const kColor2Offset = currIndex + 4;
        const kOffsetOffset = currIndex + 8;
        const kObjScaleOffset = currIndex + 10;

        instanceValues.set([rand(1),rand(1),0,1], kColor1Offset);
        instanceValues.set([rand(1),rand(1),0,1], kColor2Offset);
        instanceValues.set([rand(-0.9, 0.9),rand(-0.9, 0.9)],kOffsetOffset);
        const startScale = rand(0.1, 1.0);
        instanceValues.set([startScale, startScale], kObjScaleOffset);
        
    }
    device.queue.writeBuffer(instanceBuffer, 0, instanceValues);

    const numVerticies = 6;
    const verteDataSize = numVerticies * 2; // vec2
    const vertexDataBufferSize = verteDataSize * 4;

    // buffer
    const vertexBuffer = device.createBuffer({
        label: 'vertex buffer verticies',
        size: vertexDataBufferSize,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // values
    const vertexData = new Float32Array(verteDataSize);
    
    vertexData[0] = 0.5;
    vertexData[1] = 0.5;

    vertexData[2] = -0.5;
    vertexData[3] = -0.5;

    vertexData[4] = 0.5;
    vertexData[5] = -0.5;

    vertexData[6] = -0.5;
    vertexData[7] = 0.5;

    const indexSize = 3 * 2; // 3 verticies, 2 triangles, 4 bytes
    const indexBufferSize = indexSize * 4;

    device.queue.writeBuffer(vertexBuffer, 0, vertexData);

    // buffer
    const indexBuffer = device.createBuffer({
        label: 'index buffer',
        size: indexBufferSize,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });

    // values
    const indexData = new Uint32Array(indexSize);
    indexData[0] = 0;
    indexData[1] = 1;
    indexData[2] = 2;

    indexData[3] = 0;
    indexData[4] = 3;
    indexData[5] = 1;

    device.queue.writeBuffer(indexBuffer, 0, indexData);

    const bindGroup = device.createBindGroup({
        label: 'bind group checkerboard trees',
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: uniformBufferScale }},
            { binding: 1, resource: { buffer: uniformBufferGrid }},
        ]
    });


    // setup observer when canvas resizes
    const observer = new ResizeObserver(entries => {
        for(const entry of entries) {
            const canvas = (entry.target as HTMLCanvasElement);
            const width = entry.contentBoxSize[0].inlineSize;
            const height = entry.contentBoxSize[0].blockSize;
            canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
            canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
        }
        render(device, renderPassDescriptor, pipeline, context,bindGroup, vertexBuffer, indexBuffer, instanceBuffer, numVerticies, numObjects);
    });
    observer.observe(canvas);

    // setup sliders
    const checkerScaleSlider = document.getElementById('checkerScale') as HTMLInputElement;
    const scaleXSlider = document.getElementById('scaleX') as HTMLInputElement;
    const scaleYSlider = document.getElementById('scaleY') as HTMLInputElement;

    checkerScaleSlider.addEventListener('input', () => {
        const scaleGrid = parseInt(checkerScaleSlider.value);
        uniforms.valuesGrid[0] = scaleGrid;
        device.queue.writeBuffer(uniforms.bufferGrid, 0, uniforms.valuesGrid);
        render(device, renderPassDescriptor, pipeline, context, bindGroup, vertexBuffer, indexBuffer, instanceBuffer, numVerticies, numObjects);
    });

    scaleXSlider.addEventListener('input', () => {
        const scaleX : number = parseFloat(scaleXSlider.value);
        uniforms.valuesSize[0] = scaleX;
        device.queue.writeBuffer(uniforms.bufferSize, 0, uniforms.valuesSize);
        render(device, renderPassDescriptor, pipeline, context, bindGroup, vertexBuffer, indexBuffer, instanceBuffer, numVerticies, numObjects);
    });

    scaleYSlider.addEventListener('input', () => {
        const scaleY : number =  parseFloat(scaleYSlider.value);
        uniforms.valuesSize[1] = scaleY;
        device.queue.writeBuffer(uniforms.bufferSize, 0, uniforms.valuesSize);
        render(device, renderPassDescriptor, pipeline, context, bindGroup, vertexBuffer, indexBuffer, instanceBuffer, numVerticies, numObjects);
    });

    // initial render
    render(device, renderPassDescriptor, pipeline, context, bindGroup, vertexBuffer, indexBuffer, instanceBuffer, numVerticies, numObjects);
    
}

main();
