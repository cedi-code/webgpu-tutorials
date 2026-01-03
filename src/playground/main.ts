import { bufferManager, IndexBufferDescriptorBuilder, UniformBufferDescriptorBuilder, VertexBufferDescriptorBuilder } from '../myutils/BufferHelper.js';
import { meshHelper, primitives } from '../myutils/MeshHelper.js';

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
    });

    const numVerticies = 4;
    const triangleBufferBuilder = new VertexBufferDescriptorBuilder("Triangle Vertex Buffer", numVerticies, "vertex")
        .add(0, "position", "float32x2");

    const numObjects = 30;
    const instanceBufferBuilder = new VertexBufferDescriptorBuilder("Instance Buffer", numObjects, "instance")
        .add(1, "color1", "float32x4")
        .add(2, "color2", "float32x4")
        .add(3, "scale", "float32x2")
        .add(4, "offset", "float32x2");

    const pipeline = device.createRenderPipeline({
        label: 'hardcoded checkerboard triangle',
        layout: 'auto',
        vertex: {
            entryPoint: 'vs',
            module: vsModule,
            buffers: [
                triangleBufferBuilder.buildLayout(),
                instanceBufferBuilder.buildLayout(),
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

    bufferManager.init(device);
    // == UNIFORM STATIC BUFFER SETUP start ==

    /*
    struct UniformsScale {
        triangleScale: vec2f
    };
    */
    const scaleUniformBuilder = new UniformBufferDescriptorBuilder("Uniform Scale Buffer");
    scaleUniformBuilder.add("triangleScale", "vec2f");
    const scaleUniformDesc = scaleUniformBuilder.build();
    const uniformBufferScale = bufferManager.createBuffer(scaleUniformDesc);

    /*
    struct UniformGrid {
        gridScale: u32,
    };
    */
    const gridUniformBuilder = new UniformBufferDescriptorBuilder("Uniform Grid Buffer");
    gridUniformBuilder.add("gridScale", "u32");
    const gridUniformDesc = gridUniformBuilder.build();
    const uniformBufferGrid = bufferManager.createBuffer(gridUniformDesc);



    // values
    const uniformScaleValues = new Float32Array(scaleUniformDesc.sizeBytes / 4);
    const offsetS = scaleUniformDesc.attributes[0].offsetBytes / 4;
    uniformScaleValues[offsetS] = 1.0;
    uniformScaleValues[offsetS + 1] = 1.0;

    device.queue.writeBuffer(uniformBufferScale, 0, uniformScaleValues);

    const uniformGridValues = new Uint32Array(gridUniformDesc.sizeBytes / 4);
    const offsetG = gridUniformDesc.attributes[0].offsetBytes / 4;
    uniformGridValues[offsetG] = 8;
    device.queue.writeBuffer(uniformBufferGrid, 0, uniformGridValues);

    const uniforms : Uniforms = {            
        bufferSize: uniformBufferScale,
        valuesSize: uniformScaleValues,
        bufferGrid: uniformBufferGrid,
        valuesGrid: uniformGridValues
    };

    // == UNIFORM BUFFER SETUP end ==


    /*
    struct VertexData {
        pos: vec2f
        color1: vec4f,
        color2: vec4f,
        offset: vec2f,
        objscale: vec2f,
    };
    */
    const instanceDesc = instanceBufferBuilder.build();
    const instanceBuffer = bufferManager.createBuffer(instanceDesc);

    // values
    const instanceValues = new Float32Array(instanceDesc.unitSize * numObjects);

    for(let i : number = 0; i < numObjects; ++i) {

        const currIndex : number = instanceDesc.unitSize * i;
        const attrib = instanceDesc.attributes;
        // values
        const kColor1Offset = currIndex + attrib[0].offset;
        const kColor2Offset = currIndex + attrib[1].offset;
        const kOffsetOffset = currIndex + attrib[2].offset;
        const kObjScaleOffset = currIndex + attrib[3].offset;

        instanceValues.set([rand(1),rand(1),0,1], kColor1Offset);
        instanceValues.set([rand(1),rand(1),0,1], kColor2Offset);
        instanceValues.set([rand(-0.9, 0.9),rand(-0.9, 0.9)],kOffsetOffset);
        const startScale = rand(0.1, 1.0);
        instanceValues.set([startScale, startScale], kObjScaleOffset);
        
    }
    device.queue.writeBuffer(instanceBuffer, 0, instanceValues);

    const triangleVBDesc = triangleBufferBuilder.build();
    const vertexBuffer = bufferManager.createBuffer(triangleVBDesc);

    const meshSquare = primitives.square(0.5);
    const {v: vertexData , f: indexData} = meshHelper.convertMeshToValues(meshSquare, triangleVBDesc.unitSize);

    device.queue.writeBuffer(vertexBuffer, 0, vertexData);

    const numIndicies = meshSquare.f_size()*3;
    const indexBufferDesc = new IndexBufferDescriptorBuilder("Index Buffer", numIndicies, "uint32").build();
    const indexBuffer = bufferManager.createBuffer(indexBufferDesc);

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
        render(device, renderPassDescriptor, pipeline, context,bindGroup, vertexBuffer, indexBuffer, instanceBuffer, numIndicies, numObjects);
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
        render(device, renderPassDescriptor, pipeline, context, bindGroup, vertexBuffer, indexBuffer, instanceBuffer, numIndicies, numObjects);
    });

    scaleXSlider.addEventListener('input', () => {
        const scaleX : number = parseFloat(scaleXSlider.value);
        uniforms.valuesSize[0] = scaleX;
        device.queue.writeBuffer(uniforms.bufferSize, 0, uniforms.valuesSize);
        render(device, renderPassDescriptor, pipeline, context, bindGroup, vertexBuffer, indexBuffer, instanceBuffer, numIndicies, numObjects);
    });

    scaleYSlider.addEventListener('input', () => {
        const scaleY : number =  parseFloat(scaleYSlider.value);
        uniforms.valuesSize[1] = scaleY;
        device.queue.writeBuffer(uniforms.bufferSize, 0, uniforms.valuesSize);
        render(device, renderPassDescriptor, pipeline, context, bindGroup, vertexBuffer, indexBuffer, instanceBuffer, numIndicies, numObjects);
    });

    // initial render
    render(device, renderPassDescriptor, pipeline, context, bindGroup, vertexBuffer, indexBuffer, instanceBuffer, numIndicies, numObjects);
    
}

main();
