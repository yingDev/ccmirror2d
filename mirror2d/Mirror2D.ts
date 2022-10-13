/** authored by yingdev.com */

import {_decorator, Camera, Canvas, Component, director, Mat4, Node, Rect, renderer, RenderRoot2D, RenderTexture, Size, Sprite, SpriteFrame, Texture2D, UITransform, Vec3, view} from 'cc';
import {Mirror2DSystem} from "./Mirror2DSystem";
import {copyRect, LBRT, setRect, setSize, setVec3} from "./utils";

const {type, property, ccclass, requireComponent,disallowMultiple} = _decorator;

const WORLD_LBRT = new LBRT, SCREEN_LBRT = new LBRT;
const MAT4 = new Mat4;
const RECT = new Rect, SIZE= new Size, VEC3 = new Vec3;
const ORIG_RECT = new Rect, ORIG_POS = new Vec3;
const P_MIN_X = new Vec3, P_MAX_X = new Vec3, P_MIN_Y=new Vec3, P_MAX_Y=new Vec3;

/**
 * 将目标节点树的渲染结果显示在我们的 Sprite 上。
 * 基于此，可以方便实现截图、软遮罩、自定义特效、缓存为位图 等。
 * note: 若我们自身的 Sprite.sizeMode 为：
 * 	- RAW: 则会创建与 target 等尺寸的贴图，其尺寸受平台限制（通常不超过 2048 / dpr)。因此 target 尺寸不应过大，并且应避免频繁改变尺寸。
 * 	- CUSTOM：我们的贴图尺寸不会超过自身 UITransform.contentSize。出于性能考虑通常应选择此模式。
 */
@ccclass
@requireComponent(Sprite)
@disallowMultiple
export class Mirror2D extends Component
{
	static readonly EVENT_RENDERED = 'Mirror2D.rendered';

	@type(UITransform) target: UITransform = null;
	@property hideTarget = false;

	@type(Camera) customCamera: Camera = null;

	renderTexture: RenderTexture = null;
	private nodeChain: Node[] = [];
	private mirror: Sprite = null;
	private spriteFrame = new SpriteFrame();

	onLoad()
	{
		this.mirror = this.getComponent(Sprite);
		const rt = (this.renderTexture = new RenderTexture());
		rt.initDefault();
		rt.setWrapMode(Texture2D.WrapMode.CLAMP_TO_BORDER, Texture2D.WrapMode.CLAMP_TO_BORDER, Texture2D.WrapMode.CLAMP_TO_BORDER);

		const sf = this.spriteFrame;
		sf.reset({texture: this.renderTexture, isFlipUv: true});
		sf.packable = false;
	}

	onEnable()
	{
		Mirror2DSystem.instance.add(this);
	}

	onDisable()
	{
		Mirror2DSystem.instance.remove(this);
		this.nodeChain.length = 0;
	}

	onDestroy()
	{
		this.mirror.spriteFrame = null;
		this.spriteFrame.destroy();
		this.renderTexture?.destroy();
	}

	findCamera() : renderer.scene.Camera | null
	{
		const {nodeChain, customCamera} = this;
		let target = this.target ?? this.node._uiProps.uiTransformComp;
		if(!target?.enabledInHierarchy)
			return null;

		const canvases = <RenderRoot2D[]> director.root.batcher2D['_screens'];
		nodeChain.length = 0;
		for(let p= target.node;; )
		{
			nodeChain.push(p);
			if( !p.parent || isCanvas(p, canvases))
				break;
			p = p.parent;
		}

		const cam = customCamera ?? nodeChain[nodeChain.length-1].getComponent(Canvas)?.cameraComponent;
		if(cam?.enabled)
			return cam.camera;
		else
		{
			nodeChain.length = 0;
			return  null;
		}
	}

	frameMove(rcam: renderer.scene.Camera)
	{
		const target = this.target ?? this.node._uiProps.uiTransformComp;
		const {spriteFrame, renderTexture, mirror} = this;
		LBRT.fromUITransform(WORLD_LBRT, target, true);

		//todo: clearColor
		//save prev cam state
		copyRect(ORIG_RECT, rcam['_orientedViewport']);
		Vec3.copy(ORIG_POS, rcam.node.worldPosition);
		const origRt = rcam.window;//.targetTexture;
		const origIsWinSize = rcam.isWindowSize;
		const origFov = rcam.fov;
		const origOrtho = rcam.orthoHeight;

		let texWidth = 0, texHeight = 0;
		if(this.customCamera)
		{
			const {contentSize} = mirror.node._uiProps.uiTransformComp;
			texWidth = Math.abs(Math.round(contentSize.width));
			texHeight = Math.abs(Math.round(contentSize.height));
		}
		else
		{
			rcam.update();
			LBRT.worldToScreen(SCREEN_LBRT, rcam, WORLD_LBRT);
			//我们这里本可使用简单的 SCREEN_LBRT.get2DBoundingRect, 但由于后面也可能用于计算 fov，因此同时计算出对应的 WORLD_LBRT 点，免重复计算。
			const iXMin = SCREEN_LBRT.getMinXIndex(P_MIN_X), iXMax = SCREEN_LBRT.getMaxXIndex(P_MAX_X);
			const iYMin = SCREEN_LBRT.getMinYIndex(P_MIN_Y), iYMax = SCREEN_LBRT.getMaxYIndex(P_MAX_Y);
			const pxWith = P_MAX_X.x - P_MIN_X.x;
			const pxHeight = P_MAX_Y.y - P_MIN_Y.y;

			if(mirror.sizeMode === Sprite.SizeMode.CUSTOM)
			{
				const {contentSize} = mirror.node._uiProps.uiTransformComp;
				const scale = Math.min(1, contentSize.width / pxWith, contentSize.height / pxHeight);
				texWidth = Math.abs(Math.round(  pxWith * scale));
				texHeight = Math.abs(Math.round(pxHeight * scale));
			}
			else
			{
				//note: worldToScreen 是根据 framebuffer 尺寸计算结果，如果 Canvas 与 framebuffer 像素单位不是 1:1，那么屏幕上的尺寸就存在比例偏差
				texWidth = Math.abs(Math.round((pxWith / view.getScaleX()) ));
				texHeight = Math.abs(Math.round((pxHeight / view.getScaleY()) ));
			}

			const aspect = texWidth/texHeight;
			if(rcam.projectionType === renderer.scene.CameraProjection.PERSPECTIVE)
			{
				//fixme: 缩放过远的 target 会导致精度丢失，渲染结果可能被裁切
				//0。获得 target 四个点世界坐标, 并转为 cam 节点本地坐标
				//2。顶点 y 设为 0，得到在横屏面上的投影，顶点 x 设为 0，得到竖屏面上的投影，可以分别计算与 FORWARD 夹角
				//3。取最大夹角 * 2 得到足以显示整个 target 的 fov
				const isFovY = rcam.fovAxis === renderer.scene.CameraFOVAxis.VERTICAL;
				// for(let i=0; i<4; i++)
				// {
					// const {x,y,z} = Vec3.transformMat4(VEC3, WORLD_LBRT.getMemberByIndex(i), rcam.matView);
					// const fovH = Vec3.angle(setVec3(VEC3, isFovY ? x/aspect : x, 0, z), Vec3.FORWARD);
					// const fovV = Vec3.angle(setVec3(VEC3, 0, isFovY ? y : y*aspect, z), Vec3.FORWARD);
					// if(fovH > maxFov) maxFov = fovH;
					// if(fovV > maxFov) maxFov = fovV;
				// }
				//根据屏幕上的最大最小位置，反推应具有的 fov
				const ixFarMost = Math.abs(P_MIN_X.x - rcam.width/2) > Math.abs(P_MAX_X.x - rcam.width/2) ? iXMin : iXMax;
				const iyFarMost = Math.abs(P_MIN_Y.y - rcam.height/2) > Math.abs(P_MAX_Y.y - rcam.height/2) ? iYMin : iYMax;

				Vec3.transformMat4(VEC3, WORLD_LBRT.getMemberByIndex(ixFarMost), rcam.matView);
				const fovH = Vec3.angle(setVec3(VEC3, isFovY ? VEC3.x/aspect : VEC3.x, 0, VEC3.z), Vec3.FORWARD);

				Vec3.transformMat4(VEC3, WORLD_LBRT.getMemberByIndex(iyFarMost), rcam.matView);
				const fovV = Vec3.angle(setVec3(VEC3, 0, isFovY ? VEC3.y : VEC3.y*aspect, VEC3.z), Vec3.FORWARD);

				rcam.fov = Math.max(fovH, fovV) * 2;
			}
			else
			{
				//note: 相机未必正对 z 轴
				//平移到目标中心
				Mat4.invert(MAT4, rcam.node.worldMatrix);
				for(let i=<0|1|2|3>0; i<4; i++)
					Vec3.transformMat4(SCREEN_LBRT.getMemberByIndex(i), WORLD_LBRT.getMemberByIndex(i), MAT4);

				SCREEN_LBRT.get2DBoundingRect(RECT);
				const halfW = RECT.width/2, halfH = RECT.height/2;
				rcam.orthoHeight = Math.max(halfW, halfH);
				Vec3.transformMat4(VEC3, setVec3(VEC3, RECT.x + halfW, RECT.y + halfH, 0), rcam.node.worldMatrix);
				rcam.node.setWorldPosition(VEC3);
			}
		}

		if(renderTexture.width !== texWidth || renderTexture.height !== texHeight)
		{
			renderTexture.resize(texWidth ,texHeight);
			if(mirror.sizeMode !== Sprite.SizeMode.CUSTOM)
				mirror.spriteFrame = null;
			spriteFrame.rect = setRect(RECT, 0,0,texWidth, texHeight);
			spriteFrame.originalSize = setSize(SIZE, texWidth, texHeight);
		}

		rcam.changeTargetWindow(this.renderTexture.window);
		rcam.setFixedSize(texWidth, texHeight);

		// if(!this.customCamera)
		{
			//todo:  应该可以直接计算，不用先 update
			//使 framebuffer 正好包含 target 区域
			rcam.update();
			LBRT.worldToScreen(SCREEN_LBRT, rcam, WORLD_LBRT).get2DBoundingRect(RECT);
			rcam.setViewportInOrientedSpace(setRect(RECT,  -RECT.x / RECT.width, -RECT.y / RECT.height, texWidth / RECT.width,texHeight / RECT.height));
			//note: 设置 rect 导致 dirty，导致稍后再次 update。因为 rect 影响 aspect 影响 matProj
			//hack: 由于修改 viewport 但 aspect 没变，理论上可以避免再次更新
			rcam['_isProjDirty'] = false;
		}

		director.root.batcher2D.walk = this.walkJustTarget;
		Mirror2DSystem.instance.realFrameMove.call(director.root, 0);

		//restore orig cam state
		rcam.changeTargetWindow(origRt);
		rcam.isWindowSize = origIsWinSize;
		rcam.setViewportInOrientedSpace(ORIG_RECT);

		if(!this.customCamera)
		{
			rcam.fov = origFov;
			rcam.orthoHeight = origOrtho;
			rcam.node.setWorldPosition(ORIG_POS);
		}

		mirror.spriteFrame = spriteFrame;
		//我们此时已经在 uiRendererManager.updateAllDirtyRenderers() 之后了，所以手动更新 renderData
	  	mirror.updateRenderer();
	}

	_emitEventRendered() { this.node.emit(Mirror2D.EVENT_RENDERED, this); }

	private walkJustTarget = (node:Node, level:number) =>
	{
		const {nodeChain} = this;

		if (nodeChain.length > 0 && node === nodeChain[nodeChain.length - 1])
		{
			nodeChain.length--;
			const uicomp = node._uiProps?.uiComp;
			let renderFlag = false;
			if(uicomp)
			{
				renderFlag = uicomp['_renderFlag'];
				const allowRender = nodeChain.length === 0 && this.target && this.target.node !== this.node;
				//让父节点不渲染
				uicomp['_renderFlag'] = renderFlag && allowRender;
			}

			if(nodeChain.length === 0)
				director.root.batcher2D.walk = Mirror2DSystem.instance.realWalk;
			//内部为每个 child 调用 batcher2D.walk
			Mirror2DSystem.instance.realWalk.call(director.root.batcher2D, node, level);

			if(uicomp) //恢复父节点先前的渲染状态 （否则下一帧可能由于非 dirty 且 !_renderFlag 而不渲染了）
				uicomp['_renderFlag'] = renderFlag;

			director.root.batcher2D.walk = this.walkJustTarget;
		}
	}
}

//出于性能考虑， 我们并不沿着 parent 查找 Canvas，而是从 batcher2D._screens 中查找
const isCanvas = (node:Node, canvases: RenderRoot2D[]) =>
{
	for(let i=0; i<canvases.length; i++)
		if(canvases[i].node === node)
			return true;
	return false;
}
