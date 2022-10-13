/** authored by yingdev.com */

import {Component, director, geometry, Mat4, Node, Rect, renderer, Size, UITransform, Vec2, Vec3, Widget} from "cc";

export const setVec2 = (vec: Vec2, x:number, y:number)=>
{
	vec.x = x; vec.y = y;
	return vec;
}

export const setVec3 = (vec: Vec3, x:number, y:number, z) =>
{
	vec.x = x; vec.y = y; vec.z = z;
	return vec;
}

export const setSize = (size: Size, w:number, h:number) =>
{
	size.width = w; size.height = h;
	return size;
}

export const setRect = (rect: Rect, x:number, y:number, w:number, h:number) =>
{
	rect.x = x; rect.y =y; rect.width = w; rect.height = h;
	return rect;
}

export const copyRect =(out: Rect, src: Rect) =>
{
	out.x = src.x; out.y = src.y; out.width = src.width; out.height= src.height;
	return out;
}

export class LBRT
{
	readonly lb = new Vec3;
	readonly rt = new Vec3;
	readonly lt = new Vec3;
	readonly rb = new Vec3;

	getMemberByIndex(i: 0|1|2|3): Vec3
	{
		switch (i)
		{
			case 0: return this.lb;
			case 1: return this.rt;
			case 2: return this.lt;
			case 3: return this.rb;
		}
	}

	static fromUITransform(out: LBRT, target:UITransform, toWorldSpace=false)
	{
		const {width, height, anchorX, anchorY} = target;
		out.lt.x = out.lb.x = -width * anchorX;
		out.rt.x = out.rb.x = width * (1-anchorX);
		out.rb.y = out.lb.y = -height * anchorY;
		out.lt.y = out.rt.y = height * (1-anchorY);
		out.lb.z = out.rt.z = out.lt.z = out.rb.z = 0;

		if(toWorldSpace)
			this.localToWorld(out, out, target.node);
		return out;
	}

	static localToWorld(out: LBRT, local: LBRT, node: Node)
	{
		const mat = node.worldMatrix;
		Vec3.transformMat4(out.lb, local.lb, mat);
		Vec3.transformMat4(out.rt, local.rt, mat);
		Vec3.transformMat4(out.lt, local.lt, mat);
		Vec3.transformMat4(out.rb, local.rb, mat);
		return out;
	}

	static worldToScreen(out:LBRT, camera: renderer.scene.Camera, world: LBRT)
	{
		camera.worldToScreen(out.lb, world.lb);
		camera.worldToScreen(out.rt, world.rt);
		camera.worldToScreen(out.lt, world.lt);
		camera.worldToScreen(out.rb, world.rb);
		return out;
	}

	get2DBoundingRect(out: Rect)
	{
		const {lb, rt, lt, rb} = this;
		const minX = Math.min(lb.x, rt.x, lt.x, rb.x);
		const minY = Math.min(lb.y, rt.y, lt.y, rb.y);
		const maxX = Math.max(lb.x, rt.x, lt.x, rb.x);
		const maxY = Math.max(lb.y, rt.y, lt.y, rb.y);

		return setRect(out, minX, minY, maxX - minX, maxY - minY);
	}

	getMinXIndex(outPt?: Vec3) : 0|1|2|3
	{
		const {lb, rt, lt, rb} = this;
		let i: 0 | 1 | 2 | 3 = 0;
		let prev = lb;
		if (rt.x < prev.x) {prev = rt;i = 1;}
		if (lt.x < prev.x) {prev = lt;i = 2;}
		if (rb.x < prev.x) {prev = rb;i = 3;}
		if (outPt) Vec3.copy(outPt, prev);
		return i;
	}

	getMaxXIndex(outPt?: Vec3) : 0|1|2|3
	{
		const {lb, rt, lt, rb} = this;
		let i: 0 | 1 | 2 | 3 = 0;
		let prev = lb;
		if (rt.x > prev.x) {prev = rt;i = 1;}
		if (lt.x > prev.x) {prev = lt;i = 2;}
		if (rb.x > prev.x) {prev = rb;i = 3;}
		if (outPt) Vec3.copy(outPt, prev);
		return i;
	}

	getMinYIndex(outPt?: Vec3) : 0|1|2|3
	{
		const {lb, rt, lt, rb} = this;
		let i: 0 | 1 | 2 | 3 = 0;
		let prev = lb;
		if (rt.y < prev.y) {prev = rt;i = 1;}
		if (lt.y < prev.y) {prev = lt;i = 2;}
		if (rb.y < prev.y) {prev = rb;i = 3;}
		if (outPt) Vec3.copy(outPt, prev);
		return i;
	}

	getMaxYIndex(outPt?: Vec3) : 0|1|2|3
	{
		const {lb, rt, lt, rb} = this;
		let i: 0 | 1 | 2 | 3 = 0;
		let prev = lb;
		if (rt.y > prev.y) {prev = rt;i = 1;}
		if (lt.y > prev.y) {prev = lt;i = 2;}
		if (rb.y > prev.y) {prev = rb;i = 3;}
		if (outPt) Vec3.copy(outPt, prev);
		return i;
	}

	getMinZIndex(outPt?: Vec3) : 0|1|2|3
	{
		const {lb, rt, lt, rb} = this;
		let i: 0 | 1 | 2 | 3 = 0;
		let prev = lb;
		if (rt.z < prev.z) {prev = rt;i = 1;}
		if (lt.z < prev.z) {prev = lt;i = 2;}
		if (rb.z < prev.z) {prev = rb;i = 3;}
		if (outPt) Vec3.copy(outPt, prev);
		return i;
	}

	getMaxZIndex(outPt?: Vec3) : 0|1|2|3
	{
		const {lb, rt, lt, rb} = this;
		let i: 0 | 1 | 2 | 3 = 0;
		let prev = lb;
		if (rt.z > prev.z) {prev = rt;i = 1;}
		if (lt.z > prev.z) {prev = lt;i = 2;}
		if (rb.z > prev.z) {prev = rb;i = 3;}
		if (outPt) Vec3.copy(outPt, prev);
		return i;
	}
}

export function fastEraseAt<T>(array:Array<T>, index:number) : T|undefined
{
	const len = array.length;
	if (index < 0 || index >= len)
		return;

	const it = array[index];
	array[index] = array[len-1];
	array.length = len - 1;
	return it;
}