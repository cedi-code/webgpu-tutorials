function render(
    device : GPUDevice, 
    renderPassDescriptor : GPURenderPassDescriptor, 
    pipeline : GPURenderPipeline, 
    context : GPUCanvasContext,
    bindGroup: GPUBindGroup) {

    // get current textrure from canvas
    for(let colorAttachment of renderPassDescriptor.colorAttachments) {
        if(!colorAttachment) continue; 
        colorAttachment.view = context.getCurrentTexture().createView();
    }
    const encoder = device.createCommandEncoder({ label: 'my first encoder'});

    // make a render pass
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
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

    // == UNIFORM BUFFER SETUP start ==
    /*
        struct Uniforms {
        gridScale: u32,
        triangleScale: vec2f
    };
    */
    const uniformSize = 2 + 2;
    const uniformBufferSize = uniformSize * 4; // since 32 bits are 4 bytes

    const uniformBuffer = device.createBuffer({
        size: uniformBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const uniformData = new ArrayBuffer(uniformBufferSize);
    const uniformValuesAsF32View = new Float32Array(uniformData,8,2);
    const uniformValuesAsU32View = new Uint32Array(uniformData,0,1);
    
    uniformValuesAsU32View[0] = 4.0; // grid scale
    uniformValuesAsF32View[0] = 1.0; // triangle x scale
    uniformValuesAsF32View[1] = 1.0; // triangle y scale

    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0, resource: { buffer: uniformBuffer },
            }
        ]
    })

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
        render(device, renderPassDescriptor, pipeline, context,bindGroup);
    });
    observer.observe(canvas);

    // setup sliders
    const checkerScaleSlider = document.getElementById('checkerScale') as HTMLInputElement;
    const scaleXSlider = document.getElementById('scaleX') as HTMLInputElement;
    const scaleYSlider = document.getElementById('scaleY') as HTMLInputElement;

    checkerScaleSlider.addEventListener('input', () => {
        uniformValuesAsU32View[0] = parseInt(checkerScaleSlider.value);
        writeBuffer(device, uniformBuffer, 0, uniformData);
        render(device, renderPassDescriptor, pipeline, context,bindGroup);
    });

    scaleXSlider.addEventListener('input', () => {
        uniformValuesAsF32View[0] = parseFloat(scaleXSlider.value);
        writeBuffer(device, uniformBuffer, 0, uniformData);
        render(device, renderPassDescriptor, pipeline, context,bindGroup);
    });

    scaleYSlider.addEventListener('input', () => {
        uniformValuesAsF32View[1] = parseFloat(scaleYSlider.value);
        writeBuffer(device, uniformBuffer, 0, uniformData);
        render(device, renderPassDescriptor, pipeline, context,bindGroup);
    });

    // initial render

    writeBuffer(device, uniformBuffer, 0, uniformData);
    render(device, renderPassDescriptor, pipeline, context,bindGroup);
    
}

main();
