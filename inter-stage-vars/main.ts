interface RenderTriangleObj {
    bindGroup: GPUBindGroup
};

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
    bindGroups: RenderTriangleObj[]) {

    // get current textrure from canvas
    for(let colorAttachment of renderPassDescriptor.colorAttachments) {
        if(!colorAttachment) continue; 
        colorAttachment.view = context.getCurrentTexture().createView();
    }
    const encoder = device.createCommandEncoder({ label: 'my first encoder'});

    // make a render pass
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    for(const group of bindGroups) {
        pass.setBindGroup(0, group.bindGroup);
        pass.draw(3);
    }
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
    struct UniformStatic {
        color1: vec4f,
        color2: vec4f,
        offset: vec2f,
        objscale: vec2f,
    };
    */
    const uniformStaticSize = 
        4 + // color 1
        4 + // color 2
        2 + // offset
        2; // objscale
    const uniformStaticBufferSize = uniformStaticSize * 4; // since 32 bits are 4 bytes
    console.log(`Uniform Static Buffer Size: ${uniformStaticBufferSize} bytes`);
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

    const numObjects = 30;
    const bindGroups : RenderTriangleObj[] = [];
    

    for(let i : number = 0; i < numObjects; i++) {
        // buffer
        const uniformBuffer = device.createBuffer({
            label: 'Uniform Static Buffer obj:' + i,
            size: uniformStaticBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        {
            // values
            const uniformValues = new Float32Array(uniformStaticSize);
            const kColor1Offset = 0;
            const kColor2Offset = 4;
            const kOffsetOffset = 8;
            const kObjScaleOffset = 10;

            uniformValues.set([rand(1),rand(1),0,1], kColor1Offset);
            uniformValues.set([rand(1),rand(1),0,1], kColor2Offset);
            uniformValues.set([rand(-0.9, 0.9),rand(-0.9, 0.9)],kOffsetOffset);
            const startScale = rand(0.1, 1.0);
            uniformValues.set([startScale, startScale], kObjScaleOffset);
            device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
        }

        const bindGroup = device.createBindGroup({
            label: 'uniform bind group',
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: uniformBuffer }},
                { binding: 1, resource: { buffer: uniformBufferScale }},
                { binding: 2, resource: { buffer: uniformBufferGrid }},
            ]
        });

        bindGroups.push({
            bindGroup
        });
    }
    // == UNIFORM BUFFER SETUP end ==

    // setup observer when canvas resizes
    const observer = new ResizeObserver(entries => {
        for(const entry of entries) {
            const canvas = (entry.target as HTMLCanvasElement);
            const width = entry.contentBoxSize[0].inlineSize;
            const height = entry.contentBoxSize[0].blockSize;
            canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
            canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
        }
        render(device, renderPassDescriptor, pipeline, context,bindGroups);
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
        render(device, renderPassDescriptor, pipeline, context, bindGroups);
    });

    scaleXSlider.addEventListener('input', () => {
        const scaleX : number = parseFloat(scaleXSlider.value);
        uniforms.valuesSize[0] = scaleX;
        device.queue.writeBuffer(uniforms.bufferSize, 0, uniforms.valuesSize);
        render(device, renderPassDescriptor, pipeline, context, bindGroups);
    });

    scaleYSlider.addEventListener('input', () => {
        const scaleY : number =  parseFloat(scaleYSlider.value);
        uniforms.valuesSize[1] = scaleY;
        device.queue.writeBuffer(uniforms.bufferSize, 0, uniforms.valuesSize);
        render(device, renderPassDescriptor, pipeline, context, bindGroups);
    });

    // initial render
    render(device, renderPassDescriptor, pipeline, context, bindGroups);
    
}

main();
