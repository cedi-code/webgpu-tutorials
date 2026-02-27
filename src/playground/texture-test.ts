import { bufferManager, IndexBufferDescriptorBuilder, VertexBufferDescriptorBuilder } from '../myutils/BufferHelper.js';
import {render, getwebgpucontext} from './main.js';


console.log("== texture-test.js ==");

async function main() {
    const webgpucontext = await getwebgpucontext();
    if(!webgpucontext) {
        console.error("failed to get webgpu context");
        return;
    }
    const { gpu, adapter, device, canvas, context, presentationFormat } = webgpucontext;

    const responseVert = await fetch('shaders/texture-test-vert.wgsl');
    const responseFrag = await fetch('shaders/texture-test-frag.wgsl');
    const shaderTextVert = await responseVert.text();
    const shaderTextFrag = await responseFrag.text();

    const vsModule = device.createShaderModule({
        label: 'vertex shader texture test',
        code: shaderTextVert,
    });

    const fsModule = device.createShaderModule({
        label: 'fragment shader texture test',
        code: shaderTextFrag,
    });

    const trianglePlaneBufferBuilder = new VertexBufferDescriptorBuilder("Plane Vertex Buffer", 4, "vertex")
        .add(0, "position", "float32x3")
        .add(1, "uv", "float32x2");

    const pipeline = device.createRenderPipeline({
        label: 'texture test pipeline',
        layout: 'auto',
        vertex: {
            entryPoint: 'vs',
            module: vsModule,
            buffers: [
                trianglePlaneBufferBuilder.buildLayout()
            ],
        },
        fragment: {
            entryPoint: 'fs',
            module: fsModule,
            targets: [{ format: presentationFormat }],
        }
    });

    const renderPassDescriptor: GPURenderPassDescriptor = {
        label: 'basic pass',
        colorAttachments: [
            {
                clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1 },
                loadOp: 'clear',
                storeOp: 'store',
                view: context.getCurrentTexture().createView(),
            },
        ],
    };

    // == BUFFERS ==

    bufferManager.init(device);

    const planeVBDesc = trianglePlaneBufferBuilder.build();
    const planeVertexBuffer = bufferManager.createBuffer(planeVBDesc);

    // value
    const vertexValues = new Float32Array([
        // position         uv
        -0.5, -0.5, 0,      0, 1, // bl
        0.5, -0.5, 0,       1, 1, // br
        -0.5, 0.5, 0,       0, 0, // tl
        0.5, 0.5, 0,        1, 0, // tr
    ]);
    device.queue.writeBuffer(planeVertexBuffer, 0, vertexValues);

    const indexBufferDesc = new IndexBufferDescriptorBuilder("index buffer plane", 6, "uint32").build();
    const indexBuffer = bufferManager.createBuffer(indexBufferDesc);

    const indexValues = new Uint32Array([
        0, 1, 2,
        3, 2, 1,
    ]);

    device.queue.writeBuffer(indexBuffer, 0, indexValues);

    const observer = new ResizeObserver(entries => {
        for(const entry of entries) {
            const canvas = (entry.target as HTMLCanvasElement);
            const width = entry.contentBoxSize[0].inlineSize;
            const height = entry.contentBoxSize[0].blockSize;
            canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
            canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
        }
        for(let colorAttachment of renderPassDescriptor.colorAttachments) {
            if(!colorAttachment) continue; 
            colorAttachment.view = context.getCurrentTexture().createView();
        }
        draw(device, renderPassDescriptor, pipeline, planeVertexBuffer, indexBuffer);
        
    });
    observer.observe(canvas);


    for(let colorAttachment of renderPassDescriptor.colorAttachments) {
        if(!colorAttachment) continue; 
        colorAttachment.view = context.getCurrentTexture().createView();
    }

    draw(device, renderPassDescriptor, pipeline, planeVertexBuffer, indexBuffer);
}

function draw(device: GPUDevice, renderPassDescriptor: GPURenderPassDescriptor, pipeline: GPURenderPipeline, planeVertexBuffer: GPUBuffer, indexBuffer: GPUBuffer) {
    const encoder = device.createCommandEncoder({ label: 'my encoder'});
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, planeVertexBuffer);
    pass.setIndexBuffer(indexBuffer, 'uint32');
    pass.drawIndexed(6);
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
}


main();