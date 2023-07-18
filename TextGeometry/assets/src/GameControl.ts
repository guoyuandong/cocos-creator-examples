/*
 * @Author: guoyuandong 303726001@qq.com
 * @Date: 2023-07-15 20:28:06
 * @LastEditors: guoyuandong 303726001@qq.com
 * @LastEditTime: 2023-07-18 23:15:39
 */

import { _decorator, Component, Node, JsonAsset } from 'cc';
const { ccclass, property } = _decorator;

import { TextMeshRender } from "./TextMeshRender"

@ccclass('GameControl')
export class GameControl extends Component {

    @property({
        type:TextMeshRender,
        serializable: true
    })
    textMeshRender:TextMeshRender | null = null;

    @property({
        type:[JsonAsset]
    })
    fontJson:JsonAsset[] = [];

    rotateY:number = 0;

    defaultDepth:number = 0;
    defaultSize:number = 0;
    defaultBevelThickness:number = 0;
    defaultBevelSize:number = 0;
    defaultTesstol:number = 0;

    start() {
        this.defaultDepth = this.textMeshRender.depth;
        this.defaultSize = this.textMeshRender.size;
        this.defaultBevelThickness = this.textMeshRender.bevelThickness;
        this.defaultBevelSize = this.textMeshRender.bevelSize;
        this.defaultTesstol = this.textMeshRender.tessTol;
        this.textMeshRender.typeFace = this.fontJson[0];
    }

    update(deltaTime: number) {
        this.rotateY += 0.1;
        this.textMeshRender.node.setRotationFromEuler(0,this.rotateY,0);
    }

    editBoxEndCallback(val){
        this.textMeshRender.string = val._string;
    }

    slideCallback(val,num){
        console.log(val,num);
        console.log(typeof num)
        switch (num) {
            case "0" :
                this.textMeshRender.depth = val._progress +　this.defaultDepth;
                break;
            case "1" :
                this.textMeshRender.size = val._progress*5 + this.defaultSize;
                break;
            case "2" :
                this.textMeshRender.bevelThickness = val._progress + this.defaultBevelThickness;
                break;
            case "3" :
                this.textMeshRender.bevelSize = val._progress*0.3 + this.defaultBevelSize;
                break;
            case "3" :
                this.textMeshRender.bevelSize = val._progress*0.3 + this.defaultBevelSize;
                break;
            case "4" :
                this.textMeshRender.tessTol = val._progress*0.02 + this.defaultTesstol;
                break;    
            default :
                break;

        }
    }

    toggleGroupCallback(val,num){
        console.log("num",num)
        this.textMeshRender.typeFace = this.fontJson[num];
    }
}


