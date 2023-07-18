/*
 * @Author: guoyuandong 303726001@qq.com
 * @Date: 2023-07-17 23:22:24
 * @LastEditors: guoyuandong 303726001@qq.com
 * @LastEditTime: 2023-07-18 22:40:18
 */
import { _decorator, Component, MeshRenderer, Node, utils } from 'cc';
const { ccclass, property, executeInEditMode } = _decorator;

import {Path, extrudeGeometry} from "./ExtrudeGeometry"

@ccclass('CreateHeart')
@executeInEditMode(true)
export class CreateHeart extends Component {

    rotateY:number = 0;
    
    start() {
        const path = new Path();
        const x = 0, y = 0;
        path
        .moveTo( x, y )
        .bezierCurveTo( x, y, x - 0.5, y - 2.5, x - 2.5, y - 2.5 )
        .bezierCurveTo( x - 5.5, y - 2.5, x - 5.5, y + 1.0, x - 5.5, y + 1.0 )
        .bezierCurveTo( x - 5.5, y + 3.0, x - 3.5, y + 5.2, x, y + 7.0 )
        .bezierCurveTo( x + 3.5, y + 5.2, x + 5.5, y + 3.0, x + 5.5, y + 1.0 )
        .bezierCurveTo( x + 5.5, y + 1.0, x + 5.5, y - 2.5, x + 2.5, y - 2.5 )
        .bezierCurveTo( x + 1.0, y - 2.5, x , y , x , y )
        .circle( x, y + 2.5, 2.0 )
        .reverse();
        console.log(path)

        const geometries = extrudeGeometry(path.toShapes(),{depth:0.5,bevelEnabled:true,bevelSize:1});
        let options = {maxSubMeshes:0,maxSubMeshVertices:0,maxSubMeshIndices:0};
        options.maxSubMeshes = geometries.length;
        for(let i=0;i<geometries.length;i++){
            options.maxSubMeshVertices = Math.max(options.maxSubMeshVertices,geometries[i].positions.length/3);
            options.maxSubMeshIndices = Math.max(options.maxSubMeshIndices,geometries[i].indices16.length);
        }
        let mesh = utils.MeshUtils.createDynamicMesh(0,geometries[0],undefined,options);
        mesh.updateSubMesh(1,geometries[1]);

        this.node.getComponent(MeshRenderer).mesh = mesh;
        console.log("111")
    }

    update(deltaTime: number) {
        this.rotateY += 0.1;
        this.node.setRotationFromEuler(0,this.rotateY,0);
    }
}


