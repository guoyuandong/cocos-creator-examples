/*
 * @Author: guoyuandong 303726001@qq.com
 * @Date: 2023-07-15 20:28:06
 * @LastEditors: guoyuandong 303726001@qq.com
 * @LastEditTime: 2023-07-18 22:59:51
 */


import { _decorator, Component, Node, MeshRenderer, JsonAsset, utils, director } from 'cc';
const { ccclass, property, executeInEditMode, disallowMultiple } = _decorator;

import {TextGeometry} from "./ExtrudeGeometry";

@ccclass('TextMeshRender')
@executeInEditMode(true)
@disallowMultiple(true)
export class TextMeshRender extends MeshRenderer{

    @property({
        type: JsonAsset,
        displayOrder:-1,
        group:{name:'textInfo',id:'textInfo',displayOrder:-1}
    })
    get typeFace(){
        return this._typeFace;
    }

    set typeFace(val){
        if(val === this._typeFace)return;
        this._typeFace = val;
        this._geometryGenerator = new TextGeometry(this._typeFace.json);
        this._needUpdateMesh = true;
    }

    @property({
        displayOrder:-2,
        multiline:true,
    })
    get string(){
        return this._string;
    }

    set string(val){
        if (val === null || val === undefined) {
            val = '';
        } else {
            val = val.toString();
        }

        if( this._string === val ){
            return;
        }

        this._string = val;
        this._needUpdateMesh = true;
    }

    @property({
        group:{name:'textInfo',id:'textInfo',displayOrder:-1}
    })
    get depth(){
        return this._depth;
    }

    set depth(val){
        if( this._depth === val )return;
        this._depth = val;
        this._needUpdateMesh = true;
    }

    @property({
        group:{name:'textInfo',id:'textInfo',displayOrder:-1}
    })
    get size(){
        return this._size;
    }

    set size(val){
        if( this._size === val )return;
        this._size = val;
        this._needUpdateMesh = true;
    }

    @property({
        group:{name:'textInfo',id:'textInfo',displayOrder:-1}
    })
    get tessTol(){
        return this._tessTol;
    }

    set tessTol(val){
        if( this._tessTol === val )return;
        this._tessTol = val;
        this._needUpdateMesh = true;
    }

    @property({
        group:{name:'textInfo',id:'textInfo',displayOrder:-1}
    })
    get bevelEnabled(){
        return this._bevelEnabled;
    }

    set bevelEnabled(val){
        if( this._bevelEnabled === val )return;
        this._bevelEnabled = val;
        this._needUpdateMesh = true;
    }

    @property({
        group:{name:'textInfo',id:'textInfo',displayOrder:-1},
        visible:(function(){return this.bevelEnabled})
    })
    get bevelThickness(){
        return this._bevelThickness;
    }

    set bevelThickness(val){
        if( this._bevelThickness === val )return;
        this._bevelThickness = val;
        this._needUpdateMesh = true;
    }

    @property({
        group:{name:'textInfo',id:'textInfo',displayOrder:-1},
        visible:(function(){return this.bevelEnabled})
    })
    get bevelSize(){
        return this._bevelSize;
    }

    set bevelSize(val){
        if( this._bevelSize === val )return;
        this._bevelSize = val;
        this._needUpdateMesh = true;
    }




    

    @property({ serializable: true })
    protected _typeFace:JsonAsset | null = null;

    @property({ serializable: true })
    protected _string:string = '';

    @property({ serializable: true })
    protected _depth:number = 0.1;

    @property({ serializable: true })
    protected _size:number = 1;

    @property({ serializable: true })
    protected _bevelEnabled = false;

    @property({ serializable: true })
    protected _bevelThickness = 0.1;

    @property({ serializable: true })
    protected _bevelSize = 0.1;

    @property({ serializable: true })
    protected _tessTol = 0.0001;

    protected _typeFaceData:any = null;
    
    protected _geometryGenerator:TextGeometry | null = null;

    protected _needUpdateMesh = false;

    public updateMesh(){
        // console.log("updateMesh",director.getTotalFrames())
        if( !this._geometryGenerator )return;

        const geometries = this._geometryGenerator.generate(this.string);

        let options = {maxSubMeshes:0,maxSubMeshVertices:0,maxSubMeshIndices:0};
        options.maxSubMeshes = geometries.length;
        for(let i=0;i<geometries.length;i++){
            options.maxSubMeshVertices = Math.max(options.maxSubMeshVertices,geometries[i].positions.length/3);
            options.maxSubMeshIndices = Math.max(options.maxSubMeshIndices,geometries[i].indices16.length);
        }
        if(this.mesh){
            this.mesh = utils.MeshUtils.createDynamicMesh(0,geometries[0],this.mesh,options);
        }else{
            this.mesh = utils.MeshUtils.createDynamicMesh(0,geometries[0],undefined,options);
        }
        // this.mesh = utils.MeshUtils.createDynamicMesh(0,geometries[0],undefined,options);
        this.mesh.updateSubMesh(1,geometries[1]);

    }

    public updateGeometryInfo(){
        if( !this._geometryGenerator )return;
        this._geometryGenerator.updateInfo({depth:this._depth,size:this._size,tessTol:this._tessTol,bevelEnabled:this._bevelEnabled,bevelThickness:this._bevelThickness,bevelSize:this._bevelSize});
    }

    onLoad() {
        this._geometryGenerator = new TextGeometry(this._typeFace.json);
        this._needUpdateMesh = true;
    }

    start() {

    }

    update(deltaTime: number) {
        if(this._needUpdateMesh){
            this.updateGeometryInfo();
            this.updateMesh();
            this._needUpdateMesh = false;
        }
    }
}


