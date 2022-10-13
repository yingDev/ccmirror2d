/** authored by yingdev.com */

import { director, Node, renderer, System } from 'cc';
import { EDITOR } from 'cc/env';
import { Mirror2D } from "./Mirror2D";
import { fastEraseAt } from './utils';

export class Mirror2DSystem extends System
{
	static readonly ID = "MIRROR2D";
	static readonly instance = new Mirror2DSystem();

	private readonly mirrors: Mirror2D[] = [];
	private readonly frameMove = null;

	realFrameMove = null;
	realWalk = null;

	add(mirror: Mirror2D)
	{
		this.mirrors.indexOf(mirror) < 0 && this.mirrors.push(mirror);
	}

	remove(mirror: Mirror2D)
	{
		const index = this.mirrors.indexOf(mirror);
		index >= 0 && fastEraseAt(this.mirrors, index);
	}

	postUpdate()
	{
		if(EDITOR)
			return;
		const oldFrameMove = director.root.frameMove;
		if (oldFrameMove !== this.frameMove)
		{
			this.realFrameMove = oldFrameMove;
			director.root.frameMove = this.frameMove;
		}

		const oldWalk = director.root.batcher2D.walk;
		if(oldWalk !== this.realWalk)
			this.realWalk = oldWalk;
	}

	destroy()
	{
		if (director.root.frameMove === this.frameMove)
			director.root.frameMove = this.realFrameMove;
	}

	constructor()
	{
		super();

		const targetsToHide = new Set<Node>();
		const onlyHideChildren = new Set<Node>();

		const walkNoOp = (node:Node, level: number) => {}

		const walkExceptTargets = (node: Node, level: number) =>
		{
			if(!targetsToHide.delete(node))
				this.realWalk.call(director.root.batcher2D, node, level);
			else if(onlyHideChildren.delete(node))
			{
				director.root.batcher2D.walk = walkNoOp;
				this.realWalk.call(director.root.batcher2D, node, level);
				director.root.batcher2D.walk = this.realWalk;
			}
		}

		const origRenderCams: renderer.scene.Camera[] = [];
		const origRenderCamEnables: boolean[] = [];
		const customCams: renderer.scene.Camera[] = [];

		const toEmitRendered: Mirror2D[] = [];

		this.frameMove = (dt) =>
		{
			const {mirrors, realFrameMove, realWalk} = this;
			const {root} = director;
			const {batcher2D} = root;

			if (mirrors.length === 0)
				return realFrameMove.call(root, dt);

			//将所有 render camera 禁用，完成后还原
			const renderCams = director.getScene().renderScene.cameras as renderer.scene.Camera[];
			for (let i = 0; i < renderCams.length; i++)
			{
				origRenderCams.push(renderCams[i]);
				origRenderCamEnables.push(renderCams[i].enabled);
				renderCams[i].enabled = false;
			}

			for (let i = 0; i < mirrors.length; i++)
			{
				const mirror = mirrors[i];

				const curCam = mirror.findCamera();
				if (curCam && (curCam.enabled = origRenderCamEnables[origRenderCams.indexOf(curCam)]))
				{
					if(mirror.customCamera)
						customCams.push(curCam);

					mirror.frameMove(curCam);
					curCam.enabled = false;

					const targetNode = (mirror.target ?? mirror).node;
					if (targetNode.activeInHierarchy && mirror.hideTarget)
					{
						targetsToHide.add(targetNode);
						if(targetNode === mirror.node)
							onlyHideChildren.add(targetNode);
					}

					toEmitRendered.push(mirror);
				}
			}

			for (let i = 0; i < origRenderCams.length; i++)
				origRenderCams[i].enabled = origRenderCamEnables[i];
			origRenderCams.length = origRenderCamEnables.length = 0;

			for(let i=0; i<customCams.length; i++)
				customCams[i].enabled = false;

			batcher2D.walk = targetsToHide.size > 0 ? walkExceptTargets : realWalk;
			realFrameMove.call(root, dt);
			targetsToHide.clear();
			onlyHideChildren.clear();
			batcher2D.walk = realWalk;

			for(let i=0; i<customCams.length; i++)
				customCams[i].enabled = true;
			customCams.length = 0;

			for (let i = 0; i < toEmitRendered.length; i++)
			{
				const mirror = toEmitRendered[i];
				mirror.enabledInHierarchy && mirror._emitEventRendered();
			}
			toEmitRendered.length = 0;
		}
	}
}

director.registerSystem(Mirror2DSystem.ID, Mirror2DSystem.instance, System.Priority.LOW);
