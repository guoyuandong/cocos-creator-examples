/*
 * @Author: guoyuandong 303726001@qq.com
 * @Date: 2023-07-15 20:28:06
 * @LastEditors: guoyuandong 303726001@qq.com
 * @LastEditTime: 2023-07-18 22:58:19
 */

import * as cc from 'cc';
import {earcut} from "./earcut"


interface CustomGeometryOptions{
    depth?:number,
    bevelEnabled?:boolean,
    bevelThickness?:number,
    bevelSize?:number
}

interface Point2{
    x:number,
    y:number
}

interface Point3{
    x:number,
    y:number,
    z:number
}

interface Shape{
    points:Point2[],
    holes?:Point2[][]
}

function _area( contour ) {

    const n = contour.length;
    let a = 0.0;

    for ( let p = n - 1, q = 0; q < n; p = q ++ ) {

        a += contour[ p ].x * contour[ q ].y - contour[ q ].x * contour[ p ].y;

    }

    return a * 0.5;

}

function _isClockWise( shape ){
    return _area( shape ) < 0;
}

function _getBevelVec( inPt, inPrev, inNext ) {

    // computes for inPt the corresponding point inPt' on a new contour
    //   shifted by 1 unit (length of normalized vector) to the left
    // if we walk along contour clockwise, this new contour is outside the old one
    //
    // inPt' is the intersection of the two lines parallel to the two
    //  adjacent edges of inPt at a distance of 1 unit on the left side.

    let v_trans_x, v_trans_y, shrink_by; // resulting translation vector for inPt

    // good reading for geometry algorithms (here: line-line intersection)
    // http://geomalgorithms.com/a05-_intersect-1.html

    const v_prev_x = inPt.x - inPrev.x,
        v_prev_y = inPt.y - inPrev.y;
    const v_next_x = inNext.x - inPt.x,
        v_next_y = inNext.y - inPt.y;

    const v_prev_lensq = ( v_prev_x * v_prev_x + v_prev_y * v_prev_y );

    // check for collinear edges
    const collinear0 = ( v_prev_x * v_next_y - v_prev_y * v_next_x );

    if ( Math.abs( collinear0 ) > Number.EPSILON ) {

        // not collinear

        // length of vectors for normalizing

        const v_prev_len = Math.sqrt( v_prev_lensq );
        const v_next_len = Math.sqrt( v_next_x * v_next_x + v_next_y * v_next_y );

        // shift adjacent points by unit vectors to the left

        const ptPrevShift_x = ( inPrev.x - v_prev_y / v_prev_len );
        const ptPrevShift_y = ( inPrev.y + v_prev_x / v_prev_len );

        const ptNextShift_x = ( inNext.x - v_next_y / v_next_len );
        const ptNextShift_y = ( inNext.y + v_next_x / v_next_len );

        // scaling factor for v_prev to intersection point

        const sf = ( ( ptNextShift_x - ptPrevShift_x ) * v_next_y -
                ( ptNextShift_y - ptPrevShift_y ) * v_next_x ) /
            ( v_prev_x * v_next_y - v_prev_y * v_next_x );

        // vector from inPt to intersection point

        v_trans_x = ( ptPrevShift_x + v_prev_x * sf - inPt.x );
        v_trans_y = ( ptPrevShift_y + v_prev_y * sf - inPt.y );

        // Don't normalize!, otherwise sharp corners become ugly
        //  but prevent crazy spikes
        const v_trans_lensq = ( v_trans_x * v_trans_x + v_trans_y * v_trans_y );
        if ( v_trans_lensq <= 2 ) {

            return { x:v_trans_x, y:v_trans_y };

        } else {

            shrink_by = Math.sqrt( v_trans_lensq / 2 );

        }

    } else {

        // handle special case of collinear edges

        let direction_eq = false; // assumes: opposite

        if ( v_prev_x > Number.EPSILON ) {

            if ( v_next_x > Number.EPSILON ) {

                direction_eq = true;

            }

        } else {

            if ( v_prev_x < - Number.EPSILON ) {

                if ( v_next_x < - Number.EPSILON ) {

                    direction_eq = true;

                }

            } else {

                if ( Math.sign( v_prev_y ) === Math.sign( v_next_y ) ) {

                    direction_eq = true;

                }

            }

        }

        if ( direction_eq ) {

            // console.log("Warning: lines are a straight sequence");
            v_trans_x = - v_prev_y;
            v_trans_y = v_prev_x;
            shrink_by = Math.sqrt( v_prev_lensq );

        } else {

            // console.log("Warning: lines are a straight spike");
            v_trans_x = v_prev_x;
            v_trans_y = v_prev_y;
            shrink_by = Math.sqrt( v_prev_lensq / 2 );

        }

    }

    return { x:v_trans_x / shrink_by, y:v_trans_y / shrink_by };

}

function _computetriangleNormal(p0:Point3 , p1:Point3 , p2:Point3 ,normalize:boolean):Point3{
    const ax = p1.x - p0.x;
    const ay = p1.y - p0.y;
    const az = p1.z - p0.z;
    const bx = p2.x - p1.x;
    const by = p2.y - p1.y;
    const bz = p2.z - p1.z;

    let ox = ay * bz - az * by;
    let oy = az * bx - ax * bz;
    let oz = ax * by - ay * bx;

    if(normalize){
        let len = ox * ox + oy * oy + oz * oz;
        if (len > 0) {
            len = 1 / Math.sqrt(len);
            ox = ox * len;
            oy = oy * len;
            oz = oz * len;
        } else {
            ox = 0;
            oy = 0;
            oz = 0;
        }
    }

    return {x:ox,y:oy,z:oz}
}


function extrudeGeometry(shapes:Shape[],options:CustomGeometryOptions):cc.primitives.IDynamicGeometry[]{

    const bevelEnabled = options.bevelEnabled !== undefined ? options.bevelEnabled:false;
    const depth = options.depth !== undefined ? options.depth:1;

    let bevelThickness;
    let bevelSize;

    if(bevelEnabled){
        bevelThickness = options.bevelThickness !== undefined ? options.bevelThickness:1;
        bevelSize = options.bevelSize !== undefined ? options.bevelSize:1;
    }else{
        bevelThickness = 0;
        bevelSize = 0;
    }

    

    const addShape = (shape:Point2[],holes:Point2[][])=>{
        if(_isClockWise(shape)){
            shape.reverse();
        }
    
        let holeIndex = shape.length;
        const holeIndices = [];
        for(let i=0;i<holes.length;i++){
            const hole = holes[i];
            if(!_isClockWise(hole)){
                hole.reverse();
            }
            holeIndices.push(holeIndex);
            shape.push(...hole);
            holeIndex += hole.length;
        }
    
        const positions: number[] = [];
        const indices:number[] = [];
        const normals:number[] = [];
    
        const sidePositions: number[] = [];
        const sideIndices: number[] = [];
        const sideNormals:number[] = [];
    
        const addVertice = (verticesArr:number[],...arg)=>{
            for(let i=0;i<arg.length;i++){
                verticesArr.push(arg[i]);
            }
        };
    
        const getPosition = (index:number,out?:Point3):Point3=>{
            if(!out){
                out = {x:0,y:0,z:0};
            }
            out.x = positions[index*3];
            out.y = positions[index*3+1];
            out.z = positions[index*3+2];
            return out;
        }
    
        let vertices = shape;
        const vlen  = vertices.length;
        
        //front positions and normals
        for( let i=0; i<vlen; i++){
            const vertice = vertices[i];
            addVertice(positions,vertice.x,vertice.y,depth + bevelThickness);
            addVertice(normals,0,0,1);
        }
    
        //front indices
        const frontFace = earcut(positions,holeIndices,3);
        indices.push(...frontFace);
    
        //back positions and normals
        for( let i=0; i<vlen; i++){
            const vertice = vertices[i];
            addVertice(positions,vertice.x,vertice.y, -(depth + bevelThickness));
            addVertice(normals,0,0,-1);
        }
    
        //back indices
        for( let i=frontFace.length-1; i>=0; i--){
            indices.push(frontFace[i] + vlen);
        }
    
        holeIndices.push(vlen);
        holeIndices.unshift(0);
        let n = holeIndices.length - 2;
    
        if(bevelEnabled){
            const bevelShape = [];
    
            let n1 = 0;
            for( let i=0;i<vlen;i++){
                let j = i - 1;
                if(j < holeIndices[n1]){
                    j = holeIndices[n1+1] - 1;
                }
                let k = i + 1;
                if(k >= holeIndices[n1+1]){
                    k = holeIndices[n1];
                    n1++;
                }
                const movement = _getBevelVec( vertices[ i ], vertices[ k ], vertices[ j ] );
    
    
    
                movement.x = vertices[i].x + bevelSize*movement.x;
                movement.y = vertices[i].y + bevelSize*movement.y;
    
                bevelShape[i] = movement;
                
    
            }
    
            const p0 = {x:0,y:0,z:0};
            const p1 = {x:0,y:0,z:0};
            const p2 = {x:0,y:0,z:0};
            const p3 = {x:0,y:0,z:0};
    
            let index = 0;
            for( let m=0;m<3;m++){
                n = holeIndices.length - 2;
                for( let i=vlen-1;i>=0;i--){
                    const a = i;
                    let  b = i - 1;
                    if( b < holeIndices[n] ){
                        b = holeIndices[n+1] - 1;
                        n--;
                    }
                    const c = b + vlen;
                    const d = a + vlen;
    
                    if(m === 0){
                        getPosition(a,p0);
                        getPosition(b,p1);
                        p2.x = bevelShape[b].x;
                        p2.y = bevelShape[b].y;
                        p2.z = depth;
                        p3.x = bevelShape[a].x;
                        p3.y = bevelShape[a].y;
                        p3.z = depth;
                    }else if(m === 1){
                        p0.x = bevelShape[a].x;
                        p0.y = bevelShape[a].y;
                        p0.z = depth;
                        p1.x = bevelShape[b].x;
                        p1.y = bevelShape[b].y;
                        p1.z = depth;
                        p2.x = bevelShape[b].x;
                        p2.y = bevelShape[b].y;
                        p2.z = -depth;
                        p3.x = bevelShape[a].x;
                        p3.y = bevelShape[a].y;
                        p3.z = -depth;
                    }else if( m === 2){
                        getPosition(c,p0);
                        getPosition(d,p1);
                        p2.x = bevelShape[a].x;
                        p2.y = bevelShape[a].y;
                        p2.z = -depth;
                        p3.x = bevelShape[b].x;
                        p3.y = bevelShape[b].y;
                        p3.z = -depth;
                    }
            
                    addVertice(sidePositions,p0.x,p0.y,p0.z);
                    addVertice(sidePositions,p1.x,p1.y,p1.z);
                    addVertice(sidePositions,p2.x,p2.y,p2.z);
                    addVertice(sidePositions,p3.x,p3.y,p3.z);
            
                    const normal = _computetriangleNormal(p0,p1,p2,true);
            
                    for(let k=0;k<4;k++){
                        addVertice(sideNormals,normal.x,normal.y,normal.z);
                    }
            
                    addVertice(sideIndices,index,index+1,index+2,index+2,index+3,index);
                    index += 4;
                }
            }
            
        }else{
            for( let i=vlen-1; i>=0; i-- ){
                const a = i;
                let b = i - 1;
                if( b < holeIndices[n] ){
                    b = holeIndices[n+1] - 1;
                    n--;
                }
    
                const c = b + vlen;
                const d = a + vlen;
        
                const p0 = getPosition(a);
                const p1 = getPosition(b);
                const p2 = getPosition(c);
                const p3 = getPosition(d);
        
                addVertice(sidePositions,p0.x,p0.y,p0.z);
                addVertice(sidePositions,p1.x,p1.y,p1.z);
                addVertice(sidePositions,p2.x,p2.y,p2.z);
                addVertice(sidePositions,p3.x,p3.y,p3.z);
        
                const normal = _computetriangleNormal(p0,p1,p2,true);
        
                for(let k=0;k<4;k++){
                    addVertice(sideNormals,normal.x,normal.y,normal.z);
                }
        
                const j = (vlen - 1 - i)*4;
                addVertice(sideIndices,j,j+1,j+2,j+2,j+3,j);
            }
    
        }
    
        return [
            {positions:positions,indices:indices,normals:normals},
            {positions:sidePositions,indices:sideIndices,normals:sideNormals}
        ];
    };

    const positions: number[] = [];
    const indices:number[] = [];
    const normals:number[] = [];

    const sidePositions: number[] = [];
    const sideIndices: number[] = [];
    const sideNormals:number[] = [];

    const merge = (arr1:number[],arr2:number[],value:number=0)=>{
        let start = arr1.length;
        for(let i = 0;i<arr2.length;i++){
            arr1[start + i] = arr2[i] + value;
        }
    }
    
    for(let i=0;i<shapes.length;i++){
        const shape = shapes[i];
        const ret = addShape(shape.points,shape.holes?shape.holes:[]);
        merge(indices,ret[0].indices,positions.length/3);
        merge(positions,ret[0].positions);
        merge(normals,ret[0].normals);
        // merge(indices,ret[0].indices,positions.length/3);
        merge(sideIndices,ret[1].indices,sidePositions.length/3);
        merge(sidePositions,ret[1].positions);
        merge(sideNormals,ret[1].normals);
        // merge(sideIndices,ret[1].indices,sidePositions.length/3);
    }

    return [
        {positions:new Float32Array(positions),indices16:new Uint16Array(indices),normals:new Float32Array(normals)},
        {positions:new Float32Array(sidePositions),indices16:new Uint16Array(sideIndices),normals:new Float32Array(sideNormals)}
    ];
    
}

const KAPPA90 = 0.5522847493;

class Path{

    private _commandX = undefined;
    private _commandY = undefined;
    private _pointsArr: Point2[][] = [];
    private _points: Point2[] = [];

    public pointsOffset = 0;
    public tessTol = 0.0001;

    private _removeSame(){
        const sPoint = this._points[0];
        const ePoint = this._points[this._points.length-1];
        if(sPoint.x === ePoint.x && sPoint.y === ePoint.y){
            this._points.length -= 1;
        }
    }

    private _toShapesNoHoles( inSubpaths ) {

        const shapes = [];

        for ( let i = 0, l = inSubpaths.length; i < l; i ++ ) {

            const tmpPath = inSubpaths[ i ];

            const tmpShape:Shape = {points:tmpPath};

            shapes.push( tmpShape );

        }

        return shapes;

    }

    private _isPointInsidePolygon( inPt, inPolygon ) {

        const polyLen = inPolygon.length;

        // inPt on polygon contour => immediate success    or
        // toggling of inside/outside at every single! intersection point of an edge
        //  with the horizontal line through inPt, left of inPt
        //  not counting lowerY endpoints of edges and whole edges on that line
        let inside = false;
        for ( let p = polyLen - 1, q = 0; q < polyLen; p = q ++ ) {

            let edgeLowPt = inPolygon[ p ];
            let edgeHighPt = inPolygon[ q ];

            let edgeDx = edgeHighPt.x - edgeLowPt.x;
            let edgeDy = edgeHighPt.y - edgeLowPt.y;

            if ( Math.abs( edgeDy ) > Number.EPSILON ) {

                // not parallel
                if ( edgeDy < 0 ) {

                    edgeLowPt = inPolygon[ q ]; edgeDx = - edgeDx;
                    edgeHighPt = inPolygon[ p ]; edgeDy = - edgeDy;

                }

                if ( ( inPt.y < edgeLowPt.y ) || ( inPt.y > edgeHighPt.y ) ) 		continue;

                if ( inPt.y === edgeLowPt.y ) {

                    if ( inPt.x === edgeLowPt.x )		return	true;		// inPt is on contour ?
                    // continue;				// no intersection or edgeLowPt => doesn't count !!!

                } else {

                    const perpEdge = edgeDy * ( inPt.x - edgeLowPt.x ) - edgeDx * ( inPt.y - edgeLowPt.y );
                    if ( perpEdge === 0 )				return	true;		// inPt is on contour ?
                    if ( perpEdge < 0 ) 				continue;
                    inside = ! inside;		// true intersection left of inPt

                }

            } else {

                // parallel or collinear
                if ( inPt.y !== edgeLowPt.y ) 		continue;			// parallel
                // edge lies on the same horizontal line as inPt
                if ( ( ( edgeHighPt.x <= inPt.x ) && ( inPt.x <= edgeLowPt.x ) ) ||
                     ( ( edgeLowPt.x <= inPt.x ) && ( inPt.x <= edgeHighPt.x ) ) )		return	true;	// inPt: Point on contour !
                // continue;

            }

        }

        return	inside;

    }

    private _ellipse( cx: number, cy: number, rx: number, ry: number ){
        this.moveTo(cx - rx, cy);
        this.bezierCurveTo(cx - rx, cy + ry * KAPPA90, cx - rx * KAPPA90, cy + ry, cx, cy + ry);
        this.bezierCurveTo(cx + rx * KAPPA90, cy + ry, cx + rx, cy + ry * KAPPA90, cx + rx, cy);
        this.bezierCurveTo(cx + rx, cy - ry * KAPPA90, cx + rx * KAPPA90, cy - ry, cx, cy - ry);
        this.bezierCurveTo(cx - rx * KAPPA90, cy - ry, cx - rx, cy - ry * KAPPA90, cx - rx, cy);
    }

    public toShapes(){

        if(this._points.length>0){
            this._removeSame();
            this._pointsArr.push(this._points);
            this._points = [];
        }

        if(  this._pointsArr.length === 0 ){
            return [];
        }

        const shapes:Shape[] = [];

        if( this._pointsArr.length === 1 ){
            shapes.push({points:this._pointsArr[0]});
            return shapes;
        }

        const holesFirst = ! _isClockWise( this._pointsArr[0] );

        const newShapes = [];
		let newShapeHoles = [];
		let mainIdx = 0;

        newShapes[ mainIdx ] = undefined;
		newShapeHoles[ mainIdx ] = [];

        for(let i = 0, l = this._pointsArr.length; i < l; i++){
            const points = this._pointsArr[i];
            const solid = _isClockWise(points);

            if( solid ){
                if ( ( ! holesFirst ) && ( newShapes[ mainIdx ] ) )	mainIdx ++;

                newShapes[ mainIdx ] = points;

                if ( holesFirst )	mainIdx ++;
				newShapeHoles[ mainIdx ] = [];
            }else{
                newShapeHoles[ mainIdx ].push( points );
            }
            
        }
        
        if( ! newShapes[ 0 ] ) return  this._toShapesNoHoles(newShapeHoles[ mainIdx ]);

        const betterShapeHoles = [];

        if ( newShapes.length > 1 ) {

			let ambiguous = false;
			let toChange = 0;

			for ( let sIdx = 0, sLen = newShapes.length; sIdx < sLen; sIdx ++ ) {

				betterShapeHoles[ sIdx ] = [];

			}

			for ( let sIdx = 0, sLen = newShapes.length; sIdx < sLen; sIdx ++ ) {

				const sho = newShapeHoles[ sIdx ];

				for ( let hIdx = 0; hIdx < sho.length; hIdx ++ ) {

					const ho = sho[ hIdx ];
					let hole_unassigned = true;

					for ( let s2Idx = 0; s2Idx < newShapes.length; s2Idx ++ ) {

						if ( this._isPointInsidePolygon( ho[0], newShapes[ s2Idx ] ) ) {

							if ( sIdx !== s2Idx )	toChange ++;

							if ( hole_unassigned ) {

								hole_unassigned = false;
								betterShapeHoles[ s2Idx ].push( ho );

							} else {

								ambiguous = true;

							}

						}

					}

					if ( hole_unassigned ) {

						betterShapeHoles[ sIdx ].push( ho );

					}

				}

			}

			if ( toChange > 0 && ambiguous === false ) {

				newShapeHoles = betterShapeHoles;

			}

		}

        for ( let i = 0,il = newShapes.length; i < il; i++) {
            shapes.push({points:newShapes[i],holes:newShapeHoles[i]});
        }

        return shapes;

    }

    public clear(){
        this._pointsArr.length = 0;
        this._points.length = 0;
        this._commandX = undefined;
        this._commandY = undefined;
        this.pointsOffset = 0;
    }

    public reverse(){
        this._points.reverse();
        return this;
    }
    
    public moveTo (x: number, y: number) {
        if(this._points.length>0){
            this._removeSame();
            this._pointsArr.push(this._points);
            this._points = [];
            this._commandX = undefined;
            this._commandY = undefined;
            this.pointsOffset = 0;
        }
        
        this.addPoint(x, y);

        this._commandX = x;
        this._commandY = y;
        return this;
    }

    public lineTo (x: number, y: number) {
        this.addPoint(x, y);

        this._commandX = x;
        this._commandY = y;
        return this;
    }

    public bezierCurveTo (c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) {
        const last = this._points[this.pointsOffset-1];

        if (last.x === c1x && last.y === c1y && c2x === x && c2y === y) {
            this.lineTo(x, y);
            return;
        }

        this.tesselateBezier(last.x, last.y, c1x, c1y, c2x, c2y, x, y, 0);

        this._commandX = x;
        this._commandY = y;
        return this;
    }

    public quadraticCurveTo (cx: number, cy: number, x: number, y: number) {
        const x0 = this._commandX;
        const y0 = this._commandY;
        this.bezierCurveTo(x0 + 2.0 / 3.0 * (cx - x0), y0 + 2.0 / 3.0 * (cy - y0), x + 2.0 / 3.0 * (cx - x), y + 2.0 / 3.0 * (cy - y), x, y);
        return this;
    }

    public arc (cx: number, cy: number, r: number, startAngle: number, endAngle: number, counterclockwise: boolean) {
        counterclockwise = counterclockwise || false;

        let a = 0;
        let da = 0;
        let hda = 0;
        let kappa = 0;
        let dx = 0;
        let dy = 0;
        let x = 0;
        let y = 0;
        let tanx = 0;
        let tany = 0;
        let px = 0;
        let py = 0;
        let ptanx = 0;
        let ptany = 0;
        let i = 0;
        let ndivs = 0;
    
        // Clamp angles
        da = endAngle - startAngle;
        if (counterclockwise) {
            if (Math.abs(da) >= Math.PI * 2) {
                da = Math.PI * 2;
            } else {
                while (da < 0) { da += Math.PI * 2; }
            }
        } else if (Math.abs(da) >= Math.PI * 2) {
            da = -Math.PI * 2;
        } else {
            while (da > 0) { da -= Math.PI * 2; }
        }
    
        // Split arc into max 90 degree segments.
        ndivs = Math.max(1, Math.min(Math.abs(da) / (Math.PI * 0.5) + 0.5, 5)) | 0;
        hda = da / ndivs / 2.0;
        kappa = Math.abs(4.0 / 3.0 * (1 - Math.cos(hda)) / Math.sin(hda));
    
        if (!counterclockwise) { kappa = -kappa; }
    
        for (i = 0; i <= ndivs; i++) {
            a = startAngle + da * (i / ndivs);
            dx = Math.cos(a);
            dy = Math.sin(a);
            x = cx + dx * r;
            y = cy + dy * r;
            tanx = -dy * r * kappa;
            tany = dx * r * kappa;
    
            if (i === 0) {
                this.moveTo(x, y);
            } else {
                this.bezierCurveTo(px + ptanx, py + ptany, x - tanx, y - tany, x, y);
            }
            px = x;
            py = y;
            ptanx = tanx;
            ptany = tany;
        }

        return this;
    }

    public ellipse (cx: number, cy: number, rx: number, ry: number) {
        this._ellipse(cx, cy, rx, ry);
        return this;
    }

    public circle (cx: number, cy: number, r: number) {
        this._ellipse(cx, cy, r, r);
        return this;
    }

    public rect (x: number, y: number, w: number, h: number) {
        this.moveTo(x, y);
        this.lineTo(x + w, y);
        this.lineTo(x + w, y + h);
        this.lineTo(x, y + h);
        return this;
    }

    public roundRect (x: number, y: number, w: number, h: number, r: number) {
        if (r < 0.1) {
            this.rect(x, y, w, h);
        } else {
            const rx = Math.min(r, Math.abs(w) * 0.5) * Math.sign(w);
            const ry = Math.min(r, Math.abs(h) * 0.5) * Math.sign(h);
    
            this.moveTo(x, y + ry);
            this.lineTo(x, y + h - ry);
            this.bezierCurveTo(x, y + h - ry * (1 - KAPPA90), x + rx * (1 - KAPPA90), y + h, x + rx, y + h);
            this.lineTo(x + w - rx, y + h);
            this.bezierCurveTo(x + w - rx * (1 - KAPPA90), y + h, x + w, y + h - ry * (1 - KAPPA90), x + w, y + h - ry);
            this.lineTo(x + w, y + ry);
            this.bezierCurveTo(x + w, y + ry * (1 - KAPPA90), x + w - rx * (1 - KAPPA90), y, x + w - rx, y);
            this.lineTo(x + rx, y);
            this.bezierCurveTo(x + rx * (1 - KAPPA90), y, x, y + ry * (1 - KAPPA90), x, y + ry);
        }
        return this;
    }

    public addPoint (x: number, y: number) {

        if(this._commandX === x && this._commandY === y)return;

        const points = this._points;

        const offset = this.pointsOffset++;
        let pt: Point2 = points[offset];

        if (!pt) {
            pt = {x,y};
            points.push(pt);
        } else {
            pt.x = x;
            pt.y = y;
        }

    }

    private tesselateBezier (
        x1: number, y1: number,
        x2: number, y2: number,
        x3: number, y3: number,
        x4: number, y4: number,
        level: number
    ) {
        let x12 = 0;
        let y12 = 0;
        let x23 = 0;
        let y23 = 0;
        let x34 = 0;
        let y34 = 0;
        let x123 = 0;
        let y123 = 0;
        let x234 = 0;
        let y234 = 0;
        let x1234 = 0;
        let y1234 = 0;
        let dx = 0;
        let dy = 0;
        let d2 = 0;
        let d3 = 0;
    
        if (level > 10) {
            return;
        }
    
        x12 = (x1 + x2) * 0.5;
        y12 = (y1 + y2) * 0.5;
        x23 = (x2 + x3) * 0.5;
        y23 = (y2 + y3) * 0.5;
        x34 = (x3 + x4) * 0.5;
        y34 = (y3 + y4) * 0.5;
        x123 = (x12 + x23) * 0.5;
        y123 = (y12 + y23) * 0.5;
    
        dx = x4 - x1;
        dy = y4 - y1;
        d2 = Math.abs((x2 - x4) * dy - (y2 - y4) * dx);
        d3 = Math.abs((x3 - x4) * dy - (y3 - y4) * dx);
    
        if ((d2 + d3) * (d2 + d3) < this.tessTol * (dx * dx + dy * dy)) {
            this.addPoint(x4, y4);
            return;
        }
    
        x234 = (x23 + x34) * 0.5;
        y234 = (y23 + y34) * 0.5;
        x1234 = (x123 + x234) * 0.5;
        y1234 = (y123 + y234) * 0.5;
    
        this.tesselateBezier(x1, y1, x12, y12, x123, y123, x1234, y1234, level + 1);
        this.tesselateBezier(x1234, y1234, x234, y234, x34, y34, x4, y4, level + 1);
    }

}

interface TextGeometryInfo{
    depth?:number,
    size?:number,
    bevelEnabled?:boolean,
    bevelThickness?:number,
    bevelSize?:number,
    tessTol?:number
}

class TextGeometry{

    private _textShapeInfo = undefined;

    private _depth:number = 0.1;
    private _size:number = 1;
    private _bevelEnabled = true;
    private _bevelThickness = 0.1;
    private _bevelSize = 0.1;
    private _tessTol = 0.0001;
    
    constructor(textShapeInfo){
        this._textShapeInfo = textShapeInfo;
    }

    public updateInfo(info:TextGeometryInfo){
        if(info.depth !== undefined){
            this._depth = info.depth;
        }
        if(info.size !== undefined){
            this._size = info.size;
        }
        if(info.bevelEnabled !== undefined){
            this._bevelEnabled = info.bevelEnabled;
        }
        if(info.bevelThickness !== undefined){
            this._bevelThickness = info.bevelThickness;
        }
        if(info.bevelSize !== undefined){
            this._bevelSize = info.bevelSize;
        }
        if(info.tessTol !== undefined){
            this._tessTol = info.tessTol;
        }
    }

    public generate(text:string){
        const data = this._textShapeInfo;

        const chars = Array.from( text );
        const scale = this._size / data.resolution;
        const line_height = ( data.boundingBox.yMax - data.boundingBox.yMin + data.underlineThickness ) * scale;

        let offsetX = 0, offsetY = 0;

        const shapes = [];

        for ( let i = 0; i < chars.length; i ++ ) {

            const char = chars[ i ];
    
            if ( char === '\n' ) {
    
                offsetX = 0;
                offsetY -= line_height;
    
            } else {
    
                const ret = this._createPathfromChar( char, scale, offsetX, offsetY, data );
                offsetX += ret.offsetX;
                shapes.push(...ret.path.toShapes());
            }
    
        }

        return extrudeGeometry(shapes,{depth:this._depth,bevelEnabled:this._bevelEnabled,bevelThickness:this._bevelThickness,bevelSize:this._bevelSize});
    }

    private _createPathfromChar( char, scale, offsetX, offsetY, data ){
        const path = new Path();
        path.tessTol = this._tessTol;

        const glyph = data.glyphs[ char ] || data.glyphs[ '?' ];

        if ( ! glyph ) {
    
            console.error( 'THREE.Font: character "' + char + '" does not exists in font family ' + data.familyName + '.' );
    
            return;
    
        }
        
        let x, y, cpx, cpy, cpx1, cpy1, cpx2, cpy2;

        if ( glyph.o ) {
    
            const outline = glyph._cachedOutline || ( glyph._cachedOutline = glyph.o.split( ' ' ) );

            // console.log("outline",outline);
    
            for ( let i = 0, l = outline.length; i < l; ) {
    
                const action = outline[ i ++ ];
    
                switch ( action ) {
    
                    case 'm': // moveTo
    
                        x = outline[ i ++ ] * scale + offsetX;
                        y = outline[ i ++ ] * scale + offsetY;
    
                        path.moveTo( x, y );
    
                        break;
    
                    case 'l': // lineTo
    
                        x = outline[ i ++ ] * scale + offsetX;
                        y = outline[ i ++ ] * scale + offsetY;
    
                        path.lineTo( x, y );
    
                        break;
    
                    case 'q': // quadraticCurveTo
    
                        cpx = outline[ i ++ ] * scale + offsetX;
                        cpy = outline[ i ++ ] * scale + offsetY;
                        cpx1 = outline[ i ++ ] * scale + offsetX;
                        cpy1 = outline[ i ++ ] * scale + offsetY;
    
                        path.quadraticCurveTo( cpx1, cpy1, cpx, cpy );
    
                        break;
    
                    case 'b': // bezierCurveTo
    
                        cpx = outline[ i ++ ] * scale + offsetX;
                        cpy = outline[ i ++ ] * scale + offsetY;
                        cpx1 = outline[ i ++ ] * scale + offsetX;
                        cpy1 = outline[ i ++ ] * scale + offsetY;
                        cpx2 = outline[ i ++ ] * scale + offsetX;
                        cpy2 = outline[ i ++ ] * scale + offsetY;
    
                        path.bezierCurveTo( cpx1, cpy1, cpx2, cpy2, cpx, cpy );
    
                        break;
    
                }
    
            }
    
        }

        return { offsetX: glyph.ha * scale, path: path };
    }

    
}



export { extrudeGeometry, Path, TextGeometry };
export type { CustomGeometryOptions, Point2 };
