/**
 * Utilities
 */
NodeList.prototype.forEach = Array.prototype.forEach;

String.prototype.html_entity_decode = function()
{
    var d = M4.createElement("div", {htmlText:this.toString()});
    return d.firstChild.nodeValue;
};

Function.prototype.proxy = function(pInstance)
{
    var ref = this;
    return function(){ref.apply(pInstance, arguments);};
};

Object.clone = function(pData)
{
    var obj = {};
    for(var i in pData)
    {
        if(!pData.hasOwnProperty(i))
            continue;
        obj[i] = pData[i];
    }
    return obj;
};


/**
 * Base Class
 * Overriding - toString - whatever
 */
function Class(){}

Class.prototype = {
    super:function(pMethodName)
    {
        pMethodName = pMethodName||"constructor";
        if(!this.__SUPER__||!this.__SUPER__[pMethodName])
            throw new Error("Method '"+pMethodName+"' undefined");
        var args = [];
        for(var i = 1, max = arguments.length;i<max;i++)
            args.push(arguments[i]);
        var func;
        if(this[pMethodName]&&this[pMethodName]==this.__SUPER__[pMethodName])
            func = this.__SUPER__.__SUPER__[pMethodName].proxy(this);
        else
            func = this.__SUPER__[pMethodName].proxy(this);
        return func.apply(this, args);
    },
    toString : function()
    {
        return this.formatToString();
    },
    formatToString : function()
    {
        var t = /^function ([a-z][a-z0-9_]*)\(/i.exec(this.constructor.toString());
        var s = "[Object "+t[1];
        for(var i=0, max = arguments.length;i<max;i++)
            s+= " "+arguments[i]+"=\""+this[arguments[i]]+"\"";
        return s+"]";
    }
};

Class.extend = function(pTarget, pClassParent)
{
    for(var i in pClassParent.prototype)
    {
        pTarget.prototype[i] = pClassParent.prototype[i];
    }
    pTarget.prototype.__SUPER__ = pClassParent.prototype;
};
Class.define = function(pTarget, pExtends, pPrototype)
{
    if(pExtends.length>0)
    {
        for(var i = 0, max=pExtends.length; i<max; i++)
            Class.extend(pTarget, pExtends[i]);
    }
    for(var k in pPrototype)
        pTarget.prototype[k] = pPrototype[k];
};
function Event(pType, pBubbles)
{
    this.type = pType;
    this.bubbles = pBubbles||false;
    this.eventPhase = Event.AT_TARGET;
}

Class.define(Event, [Class], {
    target:null,
    currentTarget:null,
    eventPhase:null,
    type:null,
    bubbles:false,
    clone:function(){var e = new Event(this.type, this.bubbles);e.target = this.target;return e;},
    toString:function(){return this.formatToString("type", "eventPhase", "target", "currentTarget", "bubbles");}
});

Event.CAPTURING_PHASE = 1;
Event.AT_TARGET = 2;
Event.BUBBLING_PHASE = 3;

Event.INIT = "init";
Event.COMPLETE = "complete";


function MouseEvent(pType, pBubbles, pMouseX, pMouseY, pButton)
{
    this.type = pType;
    this.localX = pMouseX||0;
    this.localY = pMouseY||0;
    this.button = pButton||0;
    this.super("constructor", pType, pBubbles);
}
Class.define(MouseEvent, [Event], {
    localX:0,
    localY:0,
    button:0
});
MouseEvent.MOUSE_OVER = "mouse_over";
MouseEvent.MOUSE_OUT = "mouse_out";
MouseEvent.MOUSE_DOWN = "mouse_down";
MouseEvent.MOUSE_UP = "mouse_up";
MouseEvent.CLICK = "click";
MouseEvent.LEFT_BUTTON = 0;
MouseEvent.RIGHT_BUTTON = 2;
function EventDispatcher() {
    this.removeAllEventListener();
}

Class.define(EventDispatcher, [Class], {
    __listeners: {},
    __listenersCapture: {},
    addEventListener: function (pType, pHandler, pCapture) {
        if (typeof(pCapture) != "boolean")
            pCapture = false;
        if (pCapture) {
            if (!this.__listenersCapture[pType])
                this.__listenersCapture[pType] = [];
            this.__listenersCapture[pType].push(pHandler);
        }
        else {
            if (!this.__listeners[pType])
                this.__listeners[pType] = [];
            this.__listeners[pType].push(pHandler);
        }
    },
    removeEventListener: function (pType, pHandler, pCapture) {
        if (typeof(pCapture) != "boolean")
            pCapture = false;
        var t = (pCapture ? this.__listenersCapture : this.__listeners)[pType];
        if (typeof(t) == "undefined" || !t.length)
            return;
        var handlers = [];
        for (var i = 0, max = t.length; i < max; i++) {
            if (t[i] === pHandler)
                continue;
            handlers.push(t[i]);
        }
        if (pCapture)
            this.__listenersCapture[pType] = handlers;
        else
            this.__listeners[pType] = handlers;
    },
    removeAllEventListener: function (pType) {
        pType = pType || false;
        if (pType === false) {
            this.__listeners = {};
            this.__listenersCapture = {};
            return;
        }
        this.__listeners[pType] = [];
        this.__listenersCapture[pType] = [];
    },
    dispatchEvent: function (pEvent) {
        if (!pEvent.target)
            pEvent.target = this;
        pEvent.currentTarget = this;
        var a = [], p = this.parent, i, max, e;
        switch (pEvent.eventPhase) {
            case Event.CAPTURING_PHASE:
                if (typeof(this.__listenersCapture[pEvent.type]) == "undefined")
                    return;
                for (i = 0, max = this.__listenersCapture[pEvent.type].length; i < max; i++)
                    this.__listenersCapture[pEvent.type][i](pEvent);
                break;
            case Event.AT_TARGET:
                while (p) {
                    a.push(p);
                    p = p.parent;
                }
                e = Object.clone(pEvent);
                e.eventPhase = Event.CAPTURING_PHASE;
                for (i = a.length - 1; i >= 0; i--)
                    a[i].dispatchEvent(e);
                if (typeof(this.__listeners[pEvent.type]) == "object" && this.__listeners[pEvent.type].length > 0) {
                    for (i = 0, max = this.__listeners[pEvent.type].length; i < max; i++) {
                        if (this.__listeners[pEvent.type] && this.__listeners[pEvent.type][i])
                            this.__listeners[pEvent.type][i](pEvent);
                    }
                }
                if (pEvent.bubbles) {
                    e = Object.clone(pEvent);
                    e.eventPhase = Event.BUBBLING_PHASE;
                    for (i = 0, max = a.length; i < max; i++)
                        a[i].dispatchEvent(e);
                }
                break;
            case Event.BUBBLING_PHASE:
                if (typeof(this.__listeners[pEvent.type]) == "undefined")
                    return;
                for (i = 0, max = this.__listeners[pEvent.type].length; i < max; i++)
                    this.__listeners[pEvent.type][i](pEvent);
                break;
        }
    }
});
/**
 * @author Arnaud NICOLAS - arno06@gmail.com
 * M4.js
 */
if(!M4)
    var M4 = {};
M4.include = function(pFile)
{
    var s = document.getElementsByTagName("script");
    for(var j = 0, max = s.length;j<max;j++)
    {
        if((s[j].tagName.toLowerCase()=="script"&&s[j].getAttribute("src") === pFile)||
            (s[j].tagName.toLowerCase()=="link"&&s[j].getAttribute("href")=== pFile))
            return;
    }
    var f = pFile.split("/");
    f = f[f.length-1];
    var i = f.indexOf("\.") ;
    if(i==-1)
        return;
    var t = f.substr(i+1);
    var e;
    switch(t)
    {
        case "js":
            e = M4.createElement("script",{"src":pFile, "type":"text/javascript"});
            break;
        case "css":
            e = M4.createElement("link",{"href":pFile, "rel":"stylesheet"});
            break;
        default:
            return;
            break;
    }
    document.getElementsByTagName("head")[0].appendChild(e);
    return e;
};
M4.createElement = function (pNode, pProperties)
{
    var e = document.createElement(pNode);
    for(var i in pProperties)
    {
        switch(i)
        {
            case "parentNode":
                pProperties[i].appendChild(e);
                break;
            case "text":
                e.appendChild(document.createTextNode(pProperties[i]));
                break;
            case "htmlText":
                e.innerHTML = pProperties[i];
                break;
            case "style":
                for(var j in pProperties[i])
                    e[i][j] = pProperties[i][j];
                break;
            default:
                e.setAttribute(i, pProperties[i]);
                break;
        }
    }
    return e;
};
M4.geom = (function()
{
    return {
        RADIAN_TO_DEGREE:180/Math.PI,
        DEGREE_TO_RADIAN:Math.PI/180
    };
}());

function MassLoader(){this.removeAllEventListener();}
Class.define(MassLoader, [EventDispatcher], {
    __stack:null,
    __current:null,
    assets:[],
    __init:function()
    {
        this.__stack = [];
        this.__current = -1;
        this.assets = {};
        this.addEventListener(Event.START, this.loadNext.proxy(this));
    },
    loadNext:function()
    {
        if(++this.__current==this.__stack.length)
        {
            this.dispatchEvent(new Event(Event.COMPLETE, false));
            return;
        }
        var f = this.__stack[this.__current].file, id = this.__stack[this.__current].id, l, ref = this;
        if(typeof(f) != "string")
        {
            this.loadNext();
            return;
        }
        this.dispatchEvent(new Event(MassLoader.NEXT, false));
        var type = f.split(".");
        type = type[type.length-1];
        switch(type.toLowerCase())
        {
            case "wav":
            case "mp3":
            case "ogg":
                l = new Audio();
                l.addEventListener("loadeddata", this.loadNext.proxy(this), false);
                l.autoplay = false;
                l.preload = "auto";
                l.src = f;
                break;
            case "png":
            case "jpg":
            case "bmp":
            case "gif":
                l = new Image();
                l.src = f;
                break;
            case "js":
            case "css":
                l = M4.include(f);
                if(!l)
                    this.loadNext();
                break;
            default:
                this.loadNext();
                break;
        }
        this.assets[id] = l;
        l.onload = this.loadNext.proxy(this);
        l.onerror = function(){ref.dispatchEvent(new Event(MassLoader.ERROR, false));};
    },
    load:function(pFiles)
    {
        this.__init();
        for(var i in pFiles)
            this.__stack.push({id:i, file:pFiles[i]});
        this.dispatchEvent(new Event(Event.START, false));
    }
});
MassLoader.START = "start";
MassLoader.NEXT = "next";
MassLoader.ERROR = "error";

function JSLoader(pJS)
{
    this.removeAllEventListener();
    var ref = this;
    document.onreadystatechange = function()
    {
        switch(document.readyState)
        {
            case "complete":
                document.onreadystatechange = null;
                ref.load(pJS);
                break;
        }
    };
    document.onreadystatechange();
}
Class.define(JSLoader, [MassLoader], {ready:function(pHandler){this.addEventListener(Event.COMPLETE, pHandler);return this;}});
// requestAnim shim layer by Paul Irish
window.requestAnimFrame = (function(){
    return  window.requestAnimationFrame   ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame    ||
        window.oRequestAnimationFrame      ||
        window.msRequestAnimationFrame     ||
        function( callback ){
            window.setTimeout(callback, 1000 / 60);
        };
})();

/**
 * @author Arnaud NICOLAS - arno06@gmail.com
 * https://github.com/arno06/Stage
 * Stage.js
 */
function StageEvent(pType, pDelta, pBubbles)
{
    this.type = pType;
    this.delta = pDelta||0;
    this.bubbles = pBubbles||false;
    this.eventPhase = Event.AT_TARGET;
}
Class.define(StageEvent, [Event], {
    delta:0
});

Event.ADDED_TO_STAGE = "added_to_stage";
Event.REMOVED_FROM_STAGE = "removed_from_stage";
Event.ENTER_FRAME = "enter_frame";
Event.DRAWN = 'evt_drawn';

function Vector(pX, pY){this.x = pX||0; this.y = pY||0;}
Class.define(Vector, [Class], {
    x:0,
    y:0,
    add:function(pVector){return new Vector(this.x+pVector.x, this.y+pVector.y);},
    sub:function(pVector){return new Vector(this.x-pVector.x, this.y-pVector.y);},
    min:function(pVector){return new Vector(Math.min(this.x, pVector.x), Math.min(this.y, pVector.y));},
    max:function(pVector){return new Vector(Math.max(this.x, pVector.x), Math.max(this.y, pVector.y));},
    toString:function(){return this.formatToString("x", "y");}
});

function Rectangle(pX, pY, pWidth, pHeight){this.x = pX||0;	this.y = pY||0;	this.width = pWidth||0;	this.height = pHeight||0;}
Class.define(Rectangle, [Class], {
    x:0,
    y:0,
    width:0,
    height:0
});

function GenericFilter(){}
Class.define(GenericFilter, [], {props:[],_define:function(pProps){this.props = pProps;}});

function DropShadowFilter(pColor, pOffsetX, pOffsetY, pLength){this._define([
    {name:"shadowColor",value:pColor},
    {name:"shadowBlur",value:pLength},
    {name:"shadowOffsetX",value:pOffsetX},
    {name:"shadowOffsetY",value:pOffsetY}]);}
Class.define(DropShadowFilter, [GenericFilter], null);

CanvasGradient.prototype.addColor = function(pColor, pAlpha)
{
    this.addColorStop(pAlpha, pColor);
    return this;
};

function DrawingCommand(){}
Class.define(DrawingCommand, [Class, EventDispatcher], {
    commands:[],
    filters:[],
    context:null,
    stage:null,
    mouseEnabled:false,
    mask:false,
    __mouse:{over:false, press:false},
    clear:function()
    {
        this.filters = [];
        this.commands = [];
    },
    createLinearGradient:function(pStartX, pStartY, pEndX, pEndY)
    {
        return this.context.createLinearGradient(pStartX, pStartY, pEndX, pEndY);
    },
    createRadialGradient:function(pStartX, pStartY, pStartR, pEndX, pEndY, pEndR)
    {
        return this.context.createRadialGradient(pStartX, pStartY, pStartR, pEndX, pEndY, pEndR);
    },
    measureText:function(pText, pFont, pSize)
    {
        var s, f = this.context.font;
        if(typeof(pSize)!="undefined")
            pFont = pSize+" "+pFont;
        this.context.font = typeof(pFont)=="string"?pFont:this.context.font;
        s = this.context.measureText(pText);
        this.context.font = f;
        return s.width;
    },
    getPixel:function(pX, pY)
    {
        var px = this.context.getImageData(pX, pY, 1, 1);
        return {r:px.data[0], g:px.data[1], b:px.data[2], alpha:px.data[3]};
    },
    setPixel:function(pX, pY, pR, pG, pB, pAlpha)
    {
        pR = pR||0;
        pG = pG||0;
        pB = pB||0;
        pAlpha = pAlpha||1;
        pAlpha *= 255;
        this.commands.push({type:DrawingCommand.SET_PIXEL, x:pX, y:pY, r:pR, g:pG, b:pB, alpha:pAlpha});
    },
    moveTo:function(pX, pY)
    {
        this.commands.push({type:DrawingCommand.MOVE_TO, x:pX, y:pY});
    },
    lineTo:function(pX, pY)
    {
        this.commands.push({type:DrawingCommand.LINE_TO, x:pX, y:pY});
    },
    bezierCurveTo:function(pCtX, pCtY, pCt2X, pCt2Y, pX2, pY2)
    {
        this.commands.push({type:DrawingCommand.BEZIER_CURVE_TO, control1:new Vector(pCtX, pCtY), control2:new Vector(pCt2X, pCt2Y), to:new Vector(pX2, pY2)});
    },
    beginFill:function(pColor)
    {
        this.commands.push({type:DrawingCommand.BEGIN_FILL, color:pColor});
    },
    endFill:function()
    {
        this.commands.push({type:DrawingCommand.END_FILL});
    },
    setLineStyle:function(pSize, pColor, pCap, pJoin, pDashed)
    {
        this.commands.push({type:DrawingCommand.SET_LINE_STYLE, size:pSize, color:pColor, cap:pCap||"butt", join:pJoin||"miter", dash:pDashed||false});
    },
    drawRect:function(pX, pY, pWidth, pHeight)
    {
        this.commands.push({type:DrawingCommand.DRAW_RECT, x:pX, y:pY, width:pWidth, height:pHeight});
    },
    drawRoundRect:function(pX, pY, pWidth, pHeight, pTopLeft, pTopRight, pBottomRight, pBottomLeft)
    {
        this.commands.push({type:DrawingCommand.DRAW_ROUND_RECT, x:pX, y:pY, width:pWidth, height:pHeight, topLeft:pTopLeft, topRight:pTopRight, bottomLeft:pBottomLeft, bottomRight:pBottomRight});
    },
    drawArc:function(pX, pY, pRadius, pStartAngle, pEndAngle, pAntiClockWise)
    {
        this.commands.push({type:DrawingCommand.DRAW_ARC, x:pX, y:pY, radius:pRadius, startAngle:pStartAngle * M4.geom.DEGREE_TO_RADIAN, endAngle:pEndAngle * M4.geom.DEGREE_TO_RADIAN, antiClockWise:pAntiClockWise||false});
    },
    drawCircle:function(pX, pY, pRadius)
    {
        this.commands.push({type:DrawingCommand.DRAW_CIRCLE, x:pX, y:pY, radius:pRadius});
    },
    setFont:function(pFont, pSize, pColor)
    {
        this.commands.push({type:DrawingCommand.SET_FONT, font:pSize+" "+pFont, color:pColor});
    },
    drawText:function(pText, pX, pY)
    {
        this.commands.push({type:DrawingCommand.DRAW_TEXT, x:pX||0, y:pY||0, text:pText});
    },
    drawImage:function(pSource, pRectSource, pRectFinal)
    {
        this.commands.push({type:DrawingCommand.DRAW_IMG, source:pSource, rectSource:pRectSource, rectFinal:pRectFinal});
    },
    __draw:function()
    {
        if(!this.context || !this.stage)
            return;
        this.stage.__displayListIt++;
        var open  = false, cmd, textColor, c, ctx = this.context, stroke = false, over = false, cmds, j, maxj;
        ctx.shadowColor = ctx.shadowBlur = ctx.shadowOffsetX = ctx.shadowOffsetY = null;
        if(this.filters.length>0)
        {
            for(j = 0, maxj = this.filters.length;j<maxj;j++)
            {
                var f = this.filters[j];
                for(var k = 0, maxk = f.props.length;k<maxk;k++)
                    this.context[f.props[k].name] = f.props[k].value;
            }
        }
        cmds = this.commands.slice(0);
        if(this.mask)
        {
            var mcmds = this.mask.commands.slice(0);
            mcmds.push({type:DrawingCommand.CLIP});

            for(j = 0, maxj = mcmds.length-1;maxj>=j;maxj--)
                cmds.unshift(mcmds[maxj]);
        }
        for(var i = 0, max = cmds.length; i<max;i++)
        {
            cmd = cmds[i];
            switch(cmd.type)
            {
                case DrawingCommand.SET_LINE_STYLE:
                case DrawingCommand.MOVE_TO:
                case DrawingCommand.BEGIN_FILL:
                    if(ctx.lineWidth&&stroke)
                    {
                        ctx.stroke();
                        ctx.closePath();
                    }
                    if(open)
                    {
                        ctx.closePath();
                        open = false;
                    }
                    break;
            }
            switch(cmd.type)
            {
                case DrawingCommand.CLIP:
                    open = false;
                    ctx.closePath();
                    ctx.clip();
                    break;
                case DrawingCommand.MOVE_TO:
                    open = true;
                    ctx.beginPath();
                    ctx.moveTo(cmd.x, cmd.y);
                    break;
                case DrawingCommand.LINE_TO:
                    ctx.lineTo(cmd.x, cmd.y);
                    break;
                case DrawingCommand.BEZIER_CURVE_TO:
                    ctx.bezierCurveTo(cmd.control1.x, cmd.control1.y, cmd.control2.x, cmd.control2.y, cmd.to.x, cmd.to.y);
                    break;
                case DrawingCommand.SET_LINE_STYLE:
                    if(cmd.size>0)
                    {
                        ctx.beginPath();
                        stroke = true;
                    }
                    if(cmd.size)
                        ctx.lineWidth = cmd.size;
                    if(cmd.color)
                        ctx.strokeStyle = cmd.color;
                    ctx.lineCap = cmd.cap;
                    ctx.lineJoin = cmd.join;
                    if(cmd.dash)
                        ctx.setLineDash(cmd.dash);
                    break;
                case DrawingCommand.BEGIN_FILL:
                    open = true;
                    ctx.beginPath();
                    ctx.fillStyle = cmd.color;
                    break;
                case DrawingCommand.END_FILL:
                    open = false;
                    over = ctx.isPointInPath(this.stage.mouseX, this.stage.mouseY)||over;
                    ctx.fill();
                    ctx.closePath();
                    break;
                case DrawingCommand.DRAW_RECT:
                    ctx.rect(cmd.x, cmd.y, cmd.width, cmd.height);
                    break;
                case DrawingCommand.DRAW_ROUND_RECT:
                    ctx.beginPath();
                    ctx.moveTo(cmd.x+cmd.topLeft, cmd.y);
                    ctx.lineTo(cmd.x+(cmd.width-cmd.topRight), cmd.y);
                    ctx.quadraticCurveTo(cmd.x+cmd.width, cmd.y, cmd.x+cmd.width, cmd.y+cmd.topRight);
                    ctx.lineTo(cmd.x+cmd.width, cmd.y+(cmd.height-cmd.bottomRight));
                    ctx.quadraticCurveTo(cmd.x+cmd.width, cmd.y+cmd.height, cmd.x+(cmd.width-cmd.bottomRight), cmd.y+cmd.height);
                    ctx.lineTo(cmd.x+(cmd.bottomLeft), cmd.y+cmd.height);
                    ctx.quadraticCurveTo(cmd.x, cmd.y+cmd.height, cmd.x, cmd.y+(cmd.height-cmd.bottomLeft));
                    ctx.lineTo(cmd.x, cmd.y+cmd.topLeft);
                    ctx.quadraticCurveTo(cmd.x, cmd.y, cmd.x+cmd.topLeft, cmd.y);
                    over = ctx.isPointInPath(this.stage.mouseX, this.stage.mouseY)||over;
                    ctx.closePath();
                    break;
                case DrawingCommand.DRAW_ARC:
                    ctx.arc(cmd.x, cmd.y, cmd.radius, cmd.startAngle, cmd.endAngle, cmd.antiClockWise);
                    break;
                case DrawingCommand.DRAW_CIRCLE:
                    ctx.arc(cmd.x, cmd.y, cmd.radius, 0, 360*M4.geom.DEGREE_TO_RADIAN, true);
                    break;
                case DrawingCommand.SET_FONT:
                    textColor = cmd.color;
                    ctx.font = cmd.font;
                    break;
                case DrawingCommand.DRAW_TEXT:
                    c = this.context.fillStyle;
                    ctx.fillStyle = textColor;
                    ctx.textBaseline = "top";
                    ctx.fillText(cmd.text, cmd.x, cmd.y);
                    ctx.fillStyle = c;
                    break;
                case DrawingCommand.DRAW_IMG:
                    ctx.drawImage(cmd.source, cmd.rectSource.x, cmd.rectSource.y, cmd.rectSource.width, cmd.rectSource.height, cmd.rectFinal.x, cmd.rectFinal.y, cmd.rectFinal.width, cmd.rectFinal.height);
                    break;
                case DrawingCommand.SET_PIXEL:
                    var image_data = ctx.createImageData(1,1);
                    image_data.data[0] = cmd.r;
                    image_data.data[1] = cmd.g;
                    image_data.data[2] = cmd.b;
                    image_data.data[3] = cmd.alpha;
                    ctx.putImageData(image_data, cmd.x, cmd.y);
                    break;
            }
        }
        if(stroke)
        {
            over = ctx.isPointInPath(this.stage.mouseX, this.stage.mouseY)||over;
            ctx.stroke();
            ctx.closePath();
        }
        if(open)
        {
            over = ctx.isPointInPath(this.stage.mouseX, this.stage.mouseY)||over;
            ctx.fill();
            ctx.closePath();
        }
        if(this.mouseEnabled && (this.constructor.name!="Stage"))
        {
            var lx = this.stage.mouseX - this.x, ly = this.stage.mouseY - this.y;
            if(over)
            {
                if(!this.__mouse.over&&!this.stage._mouseDown)
                {
                    this.stage._registerEvent(this, new MouseEvent(MouseEvent.MOUSE_OVER, false, lx, ly));
                    this.__mouse.over = true;
                }
                if(!this.stage._mouseDown&&this.__mouse.press)
                {
                    this.dispatchEvent(new MouseEvent(MouseEvent.MOUSE_UP, false, lx, ly));
                    this.dispatchEvent(new MouseEvent(MouseEvent.CLICK, false, lx, ly));
                    this.__mouse.press = false;
                }
                if(this.stage._mouseDown&&(!this.__mouse.press&&this.__mouse.over))
                {
                    this.dispatchEvent(new MouseEvent(MouseEvent.MOUSE_DOWN, false, lx, ly));
                    this.__mouse.press = true;
                }
            }
            else if (!over && this.__mouse.over)
            {
                this.stage._registerEvent(this, new MouseEvent(MouseEvent.MOUSE_OUT, false, lx, ly));
                this.__mouse.over = false;
                this.__mouse.press = false;
            }
        }
    }
});

DrawingCommand.MOVE_TO = "cmd_moveto";
DrawingCommand.LINE_TO = "cmd_lineto";
DrawingCommand.BEZIER_CURVE_TO = "cmd_beziercurveto";
DrawingCommand.SET_LINE_STYLE = "cmd_setlinestyle";
DrawingCommand.BEGIN_FILL = "cmd_beginfill";
DrawingCommand.END_FILL = "cmd_endfill";
DrawingCommand.DRAW_RECT = "cmd_drawrect";
DrawingCommand.DRAW_ROUND_RECT = "cmd_drawroundrect";
DrawingCommand.DRAW_CIRCLE = "cmd_drawcircle";
DrawingCommand.DRAW_ARC = "cmd_drawarc";
DrawingCommand.DRAW_TEXT = "cmd_drawtext";
DrawingCommand.SET_FONT = "cmd_setfont";
DrawingCommand.DRAW_IMG = "cmd_drawimg";
DrawingCommand.SET_PIXEL = "cmd_setpixel";
DrawingCommand.CLIP = "cmd_clip";

function Sprite()
{
    this.reset();
}

Class.define(Sprite, [Vector, DrawingCommand],{
    reset:function()
    {
        this.alpha=1;
        this.rotation=0;
        this.visible=true;
        this.scaleX=1;
        this.scaleY=1;
        this.parent=null;
        this.mouseEnabled = false;
        this.__mouse = {over:false, out:true, press:false, release:true};
        this.__anoDispatch = this.dispatchEvent.proxy(this);
        this.clear();
        this.removeAllEventListener();
        this.addEventListener(Event.ADDED_TO_STAGE, this.__added.proxy(this));
    },
    draw:function()
    {
        if(!this.context||!this.parent||!this.visible)
            return;
        this.context.save();
        this.__transform();
        this.__draw();
        this.context.restore();
    },
    __added:function()
    {
        this.addEventListener(Event.REMOVED_FROM_STAGE, this.__removed.proxy(this));
        this.stage.addEventListener(Event.ENTER_FRAME, this.__anoDispatch);
    },
    __removed:function()
    {
        this.stage.removeEventListener(Event.ENTER_FRAME, this.__anoDispatch);
        this.parent = this.context = this.stage = null;
        this.reset();
    },
    __transform:function()
    {
        if(Number(this.alpha)!=1)
            this.context.globalAlpha = Number(this.alpha);
        this.context.translate(Number(this.x), Number(this.y));
        if(Number(this.rotation)!==0)
            this.context.rotate(Number(this.rotation) * M4.geom.DEGREE_TO_RADIAN);
        if(Number(this.scaleX)!==1||Number(this.scaleY)!==1)
            this.context.scale(this.scaleX, this.scaleY);
    }
});

function Container(){this.displayList = [];this.reset();}
Class.define(Container, [Sprite], {
    displayList:[],
    numChildren:0,
    reset:function()
    {
        this.super("reset");
        this.removeChildren();
        this.addEventListener(Event.ADDED_TO_STAGE, this.__added.proxy(this));
    },
    addChild:function(pDisplay)
    {
        if(pDisplay.parent)
            pDisplay.parent.removeChild(pDisplay);
        pDisplay.parent = this;
        pDisplay.context = this.context;
        pDisplay.stage = this.stage;
        this.displayList.push(pDisplay);
        this.numChildren = this.displayList.length;
        pDisplay.dispatchEvent(new Event(Event.ADDED_TO_STAGE, false));
    },
    removeChild:function(pDisplay)
    {
        if(!pDisplay.parent || pDisplay.parent!=this)
            return;
        var n = [];
        for(var i = 0, max = this.displayList.length; i<max;i++)
        {
            if(this.displayList[i]==pDisplay)
                continue;
            n.push(this.displayList[i]);
        }
        pDisplay.dispatchEvent(new Event(Event.REMOVED_FROM_STAGE, false));
        this.displayList = n;
        this.numChildren = this.displayList.length;
    },
    removeChildren:function()
    {
        this.displayList.forEach(function(pTarget)
        {
            pTarget.dispatchEvent(new Event(Event.REMOVED_FROM_STAGE, false));
        });
        this.displayList = [];
        this.numChildren = this.displayList.length;
    },
    getChildAt:function(pIndex)
    {
        return this.displayList[pIndex];
    },
    draw:function()
    {
        if(!this.visible)
            return;
        this.context.save();
        this.__transform();
        this.__draw();
        this.displayList.forEach(function(pTarget)
        {
            pTarget.draw();
        });
        this.context.restore();
    },
    __added:function()
    {
        this.addEventListener(Event.REMOVED_FROM_STAGE, this.__removed.proxy(this));
        for(var i = 0, max = this.displayList.length; i<max; i++)
            this.displayList[i].context = this.context;
    }
});

function Stage(pWidth, pHeight, pParent)
{
    this.reset();
    this.stage = this;
    this.mouseX = 0;
    this.mouseY = 0;
    this._mouseDown = false;
    this.rightClick = false;
    this.width = pWidth;
    this.height = pHeight;
    this._lastTime = (new Date()).getTime();
    this.domElement = M4.createElement("canvas", {width:this.width, height:this.height});
    var parentNode = window.document.body;
    if(pParent && typeof(pParent) == "string")
        parentNode = document.querySelector(pParent);
    else if (pParent && pParent.parentNode)
        parentNode = pParent;
    parentNode.appendChild(this.domElement);
    this.context = this.domElement.getContext("2d");
    this.resume();
    this.defineInteractiveListeners();
}
Class.define(Stage, [Container], {
    countDisplayList: 0,
    __displayListIt : 0,
    __mouseOver:false,
    __mouseEvents:{},
    _lastTime : 0,
    rightClick:false,
    running:false,
    pause:function()
    {
        this.running = false;
    },
    resume:function()
    {
        if(this.running)
            return;
        this.running = true;
        requestAnimFrame(this.frameHandler.proxy(this));
    },
    frameHandler:function()
    {
        this.__mouseOver = false;
        var now = (new Date()).getTime();
        this.countDisplayList = this.__displayListIt;
        this.__displayListIt = 0;
        this.dispatchEvent(new StageEvent(Event.ENTER_FRAME, Math.min((now - this._lastTime) / 1000.0, 0.1)));
        this.context.clearRect(0,0,this.width, this.height);
        this.__mouseEvents = {};
        this.draw();
        this.dispatchEvent(new Event(Event.DRAWN));
        this._dispatchEvents();
        this._lastTime = now;
        if(this.running)
            requestAnimFrame(this.frameHandler.proxy(this));
    },
    _registerEvent:function(pTarget, pEvent)
    {
        if(!this.__mouseEvents[pEvent.type])
            this.__mouseEvents[pEvent.type] = [];
        this.__mouseEvents[pEvent.type].push({target:pTarget, event:pEvent});
    },
    _dispatchEvents:function()
    {
        var order = [MouseEvent.MOUSE_OUT, MouseEvent.MOUSE_OVER];
        for(var i = 0, max = order.length;i<max;i++)
        {
            var evt = this.__mouseEvents[order[i]];
            if(!evt||!evt.length)
                continue;
            for(var j = 0, maxj = evt.length;j<maxj;j++)
            {
                evt[j].target.dispatchEvent(evt[j].event);
            }
            if(i==0)
            {
                this.setOver(false);
            }
            else
                this.setOver(true);
        }
    },
    defineInteractiveListeners:function()
    {
        var ref = this;
        this.domElement.onclick = function(e)
        {
            ref.mouseX = e.offsetX|| e.layerX;
            ref.mouseY = e.offsetY|| e.layerY;
            ref.rightClick = e.button == MouseEvent.RIGHT_BUTTON;
            ref.dispatchEvent(new MouseEvent(MouseEvent.CLICK, false, ref.mouseX, ref.mouseY, e.button));
            e.stopPropagation();
            e.preventDefault();
        };
        this.domElement.onmousemove = function(e)
        {
            ref.mouseX = e.offsetX|| e.layerX;
            ref.mouseY = e.offsetY|| e.layerY;
        };
        this.domElement.onmousedown = function(e)
        {
            ref.mouseX = e.offsetX|| e.layerX;
            ref.mouseY = e.offsetY|| e.layerY;
            ref.rightClick = e.button == MouseEvent.RIGHT_BUTTON;
            ref.dispatchEvent(new MouseEvent(MouseEvent.MOUSE_DOWN, false, ref.mouseX, ref.mouseY, e.button));
            e.stopPropagation();
            e.preventDefault();
            ref._mouseDown = true;
        };
        this.domElement.onmouseout = function(e)
        {
            ref.mouseX = e.offsetX|| e.layerX;
            ref.mouseY = e.offsetY|| e.layerY;
            ref.rightClick = e.button == MouseEvent.RIGHT_BUTTON;
            ref.dispatchEvent(new MouseEvent(MouseEvent.MOUSE_OUT, false, ref.mouseX, ref.mouseY, e.button));
        };
        this.domElement.onmouseup = function(e)
        {
            ref.mouseX = e.offsetX||e.layerX;
            ref.mouseY = e.offsetY||e.layerY;
            ref.rightClick = e.button == MouseEvent.RIGHT_BUTTON;
            ref.dispatchEvent(new MouseEvent(MouseEvent.MOUSE_UP, false, ref.mouseX, ref.mouseY, e.button));
            e.stopPropagation();
            e.preventDefault();
            ref._mouseDown = false;
        };
    },
    setOver:function(pValue)
    {
        this.__mouseOver = pValue||this.__mouseOver;
        if(this.__mouseOver)
            this.domElement.style.cursor = "pointer";
        else
            this.domElement.style.cursor = "default";
    }
});

function FPS()
{
    this.reset();
    this.currentFPS = "...";
    this.ms = "...";
    this.tick = 0;
    this.oldTimer = (new Date()).getTime();
    this.anoAdded = this._addedHandler.proxy(this);
    this.anoRemoved = this._removedHandler.proxy(this);
    this.anoEnter = this.updateFPS.proxy(this);
    this.addEventListener(Event.ADDED_TO_STAGE, this.anoAdded);
    this.addEventListener(Event.REMOVED_FROM_STAGE, this.anoRemoved);
}
Class.define(FPS, [Sprite], {
    _addedHandler:function()
    {
        this.stage.addEventListener(Event.ENTER_FRAME, this.anoEnter);
    },
    _removedHandler:function()
    {
        this.stage.removeEventListener(Event.ENTER_FRAME, this.anoEnter);
    },
    updateFPS:function()
    {
        var currentTimer = (new Date()).getTime();
        if(currentTimer - 1000 > this.oldTimer)
        {
            this.currentFPS = this.tick;
            this.tick = 0;
            this.oldTimer = currentTimer;
        }
        if(this.currentFPS == "...")
            this.ms = "...";
        else
            this.ms = Math.max(0, Math.round(((currentTimer - this.oldMS) - (1000/this.currentFPS))*10)/10);
        this.oldMS = currentTimer;
        this.tick++;

        this.clear();
        this.beginFill("rgb(40, 40, 40)");
        this.drawRect(0, 0, 195, 15);
        this.endFill();
        this.setFont("Arial", "10px", "rgb(255, 125, 0)");
        this.drawText("FPS : "+this.currentFPS, 3, 1);
        this.setFont("Arial", "10px", "rgb(0, 125, 255)");
        this.drawText("MS : "+this.ms, 70, 1);
        this.setFont("Arial", "10px", "rgb(125, 255, 0)");
        this.drawText("DRAW : "+this.stage.countDisplayList, 125, 1);
    }
});

function SpriteSheetAnimator(pImg, pDefault, pSpeed)
{
    this._config(pImg, pDefault, pSpeed);
}
Class.define(SpriteSheetAnimator, [Sprite], {
    _animationPool:[],
    _config:function(pImg, pDefault, pSpeed)
    {
        this.reset();
        this.resetAnim();
        this.image = pImg;
        this.anims = {default:pDefault};
        this.currentAnim = "default";
        this.step = 0;
        this.oldTimer=null;
        this.currentTimer=null;
        this.timer = 1000/pSpeed;
        this.addEventListener(Event.ADDED_TO_STAGE, this._addedHandler.proxy(this));
    },
    _addedHandler:function()
    {
        this.stage.addEventListener(Event.ENTER_FRAME, this.drawingHandler.proxy(this));
    },
    drawingHandler:function()
    {
        var a;
        this.currentTimer = (new Date()).getTime();
        if(this.oldTimer&&(this.currentTimer-this.oldTimer<this.timer))
            return;
        if(this.currentAnim == null)
        {
            a = this.shiftAnim();
            if(a == null)
                return;
            this.step = 0;
            this.currentAnim = a;
        }
        this.oldTimer = this.currentTimer;
        if(this.step>=this.anims[this.currentAnim].length)
        {
            this.step = 0;
            a = this.shiftAnim();
            if(a != null)
                this.currentAnim = a;
        }
        var s = this.anims[this.currentAnim][this.step];
        this.clear();
        this.drawImage(this.image, new Rectangle(s.x, s.y, s.width, s.height), new Rectangle(-(s.width>>1), -(s.height>>1), s.width, s.height));
        this.step++;
    },
    resetAnim:function()
    {
        this._animationPool = [];
        this.currentAnim = null;
    },
    addAnim:function(pAnim)
    {
        this._animationPool.push(pAnim);

    },
    shiftAnim:function()
    {
        if(!this._animationPool.length)
            return null;
        return this._animationPool.shift();
    },
    currentlyPlaying:function()
    {
        for(var i = 0, max = arguments.length;i<max;i++)
        {
            if(arguments[i] === this.currentAnim)
                return true;
        }
        return false;
    },
    toString:function(){return this.formatToString("currentAnim");}
});

function Bitmap(pSrc)
{
    this.reset();
    this.image = new Image();
    this.image.addEventListener("load", this.imageLoadedHandler.proxy(this), false);
    this.image.src = pSrc;
}

Class.define(Bitmap, [Sprite],
    {
        imageLoadedHandler:function()
        {
            this.clear();
            this.drawImage(this.image, new Rectangle(0, 0, this.image.width, this.image.height), new Rectangle(0, 0, this.image.width, this.image.height));
        }
    });