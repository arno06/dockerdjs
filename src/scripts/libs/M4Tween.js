const M4Tween = (function(){
    let M4 = window['M4']||{};
    M4.browser = (function() {
        let ua = navigator.userAgent;
        return {
            IE:ua.indexOf("MSIE")>-1,
            FF:ua.indexOf("Firefox")>-1,
            CHROME:ua.indexOf("Chrome")>-1,
            SAFARI:ua.indexOf("AppleWebKit")>-1&&ua.indexOf("Chrome")===-1
        };
    })();
    function M4Tween(){this.configure(null, null, 0, null, 0, null);}

    M4Tween.prototype = {
        configure:function (pTarget, pFirstInfos, pDuration, pEase, pDelay, pStyle)
        {
            this.startHandler = null;
            this.updateHandler = null;
            this.completeHandler = null;
            this.startTime = null;
            this.delay = pDelay;
            this.target = pTarget;
            this.context = pStyle?this.target.style:this.target;
            this.useStyle = pStyle;
            this.firstInfos = pFirstInfos;
            this.durationTime = pDuration;
            this.ease = pEase;
        },
        start:function()
        {
            this.waiting = null;
            this.startTime = new Date().getTime();
            let f = this.firstInfos, t = this.target;
            if(this.useStyle)
            {
                if(document&&document.defaultView&&document.defaultView.getComputedStyle)
                    t = document.defaultView.getComputedStyle(this.target, null);
                else
                    t = this.target['currentStyle']||this.target.style;
            }
            while(f)
            {
                f.extractStartValue(t, this.useStyle, this.context);
                f = f.next;
            }
            if(this.startHandler)
            {
                this.startHandler();
            }
        },
        update:function(pDt)
        {
            let timer, t, factor, i, transforms = '';
            timer = (pDt - this.startTime) * .001;
            t = (timer<this.durationTime);
            factor = t? this.ease(timer, 0, 1, this.durationTime ):1;
            i = this.firstInfos;
            while(i)
            {
                if(i.property === 'transform'){
                    transforms += i.update(factor)+' ';
                }else{
                    this.context[i.property] = i.update(factor);
                }
                i = i.next;
            }
            if(transforms !== ''){
                this.context.transform = transforms;
            }
            if(typeof(this.updateHandler)=="function")
                this.updateHandler(this.context);
            if(!t)
                this.kill(true);
        },
        kill:function(pTrigger)
        {
            if(pTrigger !== true)
                this.completeHandler = null;

            if(this===M4Tween.first)
            {
                M4Tween.first = this.next;
                if(M4Tween.first)
                    M4Tween.first.prev = null;
            }
            if(this.prev)
                this.prev.next = this.next;
            if(this.next)
                this.next.prev = this.prev;

            M4Tween.GC.push(this);
            if(typeof(this.completeHandler) == "function")
                this.completeHandler(this.target);
        },
        onComplete:function(pHandler){this.completeHandler = pHandler;return this;},
        onStart:function(pHandler){this.startHandler = pHandler;return this;},
        onUpdate:function (pHandler){this.updateHandler = pHandler;return this;},
        then:function(pTarget, pTime, pProperty)
        {
            if(!pProperty.delay)
                pProperty.delay = 0;
            pProperty.delay += this.delay + this.durationTime;
            return M4Tween.to(pTarget, pTime, pProperty);
        }
    };
    M4Tween.to = function(pTarget, pTime, pProperty)
    {
        if(!pTarget)
            return;
        let a, ease = M4Tween.Quad.easeInOut,firstInfos,tmp = {}, property, style, delay = 0, k, key = Object.keys(pProperty);
        style = typeof(pProperty.useStyle)!="undefined"?pProperty.useStyle:M4Tween.useStyle;
        for(let i = 0, max = key.length;i<max;i++)
        {
            property = key[i];
            k = pProperty[property];
            switch(property)
            {
                case "ease":
                    ease = k;
                    continue;
                case "delay":
                    delay = Number(k);
                    continue;
                case "useStyle":
                    continue;
            }
            if(typeof(M4TweenPlugins[property])=="undefined")
                property = "defaultProp";
            if(typeof(M4TweenPlugins[property])!="object")
                continue;
            a = M4TweenPlugins[property].newInfos(key[i], k, style);
            a.extractStartValue = M4TweenPlugins[property].extractStartValue;
            if(!firstInfos)
                firstInfos = a;
            else
                tmp.next = a;
            tmp = a;
        }

        M4Tween.initPool();
        let instance = M4Tween.current;
        M4Tween.current = instance.nextInPool;
        instance.nextInPool = null;
        instance.configure(pTarget, firstInfos, pTime, ease, delay, style);
        if(delay)
            instance.waiting = (new Date()).getTime()+(delay * 1000);
        else
            instance.start();


        if(M4Tween.first)
        {
            M4Tween.first.prev = instance;
            instance.next = M4Tween.first;
        }
        M4Tween.first = instance;
        if(!M4Tween.running)
            M4Tween.running = window.requestAnimationFrame(M4Tween.step);
        return instance;
    };

    M4Tween.TIME = Math.round(1000/60);
    M4Tween.GROWTH_RATE = 2000;
    M4Tween.current = null;
    M4Tween.first = null;
    M4Tween.running = 0;
    M4Tween.useStyle = true;
    M4Tween.GC = [];

    M4Tween.step = function()
    {
        while(M4Tween.GC.length)
        {
            let t = M4Tween.GC.shift();
            t.next = t.prev = t.firstInfos = t.waiting = null;
            t.nextInPool = M4Tween.current;
            M4Tween.current = t;
        }
        M4Tween.GC = [];
        let i = M4Tween.first;
        if(!i)
        {
            M4Tween.running = 0;
            return;
        }
        let t = new Date().getTime();
        while(i)
        {
            if(i.waiting != null && i.waiting <= t)
                i.start();
            if(i.waiting==null)
                i.update(t);
            i = i.next;
        }
        M4Tween.running = window.requestAnimationFrame(M4Tween.step);
    };

    M4Tween.initPool = function (pNumber)
    {
        if(M4Tween.current)
            return;
        if(!pNumber)
            pNumber = M4Tween.GROWTH_RATE;
        let e, i = pNumber;
        while(i--)
        {
            e = new M4Tween();
            e.nextInPool = M4Tween.current;
            M4Tween.current = e;
        }
    };

    M4Tween.killTweensOf = function (pTarget, pComplete)
    {
        let i = M4Tween.first;
        while(i)
        {
            if(i.target === pTarget)
                i.kill(pComplete);
            i = i.next;
        }
    };

    function M4TweenInfos(pProperty, pFinalValue, pType, pTemplateValue)
    {
        this.extractStartValue = null; this.startValue = null; this.distanceValue = null;
        this.property = pProperty;
        this.finalValue = Number(pFinalValue);
        this.type = pType;
        this.templateValue = pTemplateValue;
    }
    M4TweenInfos.prototype= {
        update:function(pFactor)
        {
            let v = (this.startValue + ( pFactor * this.distanceValue))+""+this.type;
            return !this.templateValue?v:this.templateValue.replace(/#value#/, v);
        },
        setStartValue:function(pValue)
        {
            this.startValue = Number(pValue);
            this.distanceValue = this.finalValue - this.startValue;
        }
    };

    function M4TweenColorInfos(pProperty, pFinalValue)
    {
        this.extractStartValue = null; this.startValue = null;
        this.property = pProperty;
        this.finalValue = Number(pFinalValue);
        this.r = new M4TweenInfos("r",((this.finalValue&parseInt("FF0000", 16))>>16), null,null);
        this.g = new M4TweenInfos("g",((this.finalValue&parseInt("00FF00", 16))>>8), null,null);
        this.b = new M4TweenInfos("b",(this.finalValue&parseInt("0000FF", 16)), null,null);
    }
    M4TweenColorInfos.prototype = {
        update:function (pFactor)
        {
            let r = Math.round(this.r.startValue+ (pFactor * this.r.distanceValue));
            let g = Math.round(this.g.startValue+ (pFactor * this.g.distanceValue));
            let b = Math.round(this.b.startValue+ (pFactor * this.b.distanceValue));
            return "rgb("+r+", "+g+", "+b+")";
        },
        setStartValue:function(pValue)
        {
            this.startValue = Number(pValue);
            this.r.setStartValue((this.startValue&parseInt("FF0000", 16))>>16);
            this.g.setStartValue((this.startValue&parseInt("00FF00", 16))>>8);
            this.b.setStartValue(this.startValue&parseInt("0000FF", 16));
        }
    };

    if(typeof(M4TweenPlugins)=="undefined")
        function M4TweenPlugins(){}

    M4TweenPlugins.color = {
        extractStartValue:function(pCtx)
        {
            let t = pCtx[this.property].match(/rgb\(([0-9]+),\s*([0-9]+),\s*([0-9]+)\)/i);
            if(t)
                this.setStartValue(t[1]<<16|t[2]<<8|t[3]);
            else {
                t = pCtx[this.property].match(/#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})/i);
                if(t){
                    this.setStartValue(parseInt(t[1],16)<<16|parseInt(t[2],16)<<8|parseInt(t[3],16));
                }
            }
        },
        newInfos:function(pProperty, pFinalValue)
        {
            return new M4TweenColorInfos(pProperty, parseInt(pFinalValue.replace("#", ""), 16));
        }
    };

    M4TweenPlugins.backgroundColor = {};
    for(let i in M4TweenPlugins.color)
    {
        if(M4TweenPlugins.color.hasOwnProperty(i))
            M4TweenPlugins.backgroundColor[i] = M4TweenPlugins.color[i];
    }

    M4TweenPlugins.opacity = {
        extractStartValue:function(pCtx, pStyle)
        {
            let s = pCtx[this.property];
            if(pStyle && M4.browser.IE && (!document["documentMode"] || document["documentMode"] < 9))
            {
                try
                {
                    s = s.replace(/alpha\(opacity=/,"");
                    s = s.replace(/\)/,"");
                    s = s!==""?s:100;
                }
                catch(ex){s = 100;}
            }
            this.setStartValue(s);
        },
        newInfos:function(pProperty, pFinalValue, pStyle)
        {
            let prop = "opacity", template;
            if(pStyle && M4.browser.IE && (!document["documentMode"] || document["documentMode"] < 9))
            {
                pFinalValue *= 100;
                prop = "filter";
                template = "alpha(opacity=#value#)";
            }
            return new M4TweenInfos(prop, pFinalValue, "", template);
        }
    };

    M4TweenPlugins.defaultProp = {
        extractStartValue:function(pCtx, pUseStyle, pRealCtx)
        {
            let current = String(pCtx[this.property]);
            if(this.type==="%"&&String(current).replace(/(px|%)/,"")!=="0")
            {
                let setCtx = pCtx;
                if(pUseStyle)
                    setCtx = pRealCtx;
                setCtx[this.property] = "auto";
                let max = String(pCtx[this.property]).replace(/(px|%)/, '');
                setCtx[this.property] = current;
                current = Math.round((current.replace(/(px|%)/, "") / max) * 1000)/10;
            }
            this.setStartValue(String(current).replace(/(px|%)/,"")||0);
        },
        newInfos:function(pProperty, pFinalValue)
        {
            let s = String(pFinalValue), type = "",
                p = s.search(/(px|%)/);
            if(p>-1)
                type = s.substr(p);
            return new M4TweenInfos(pProperty, s.replace(/(px|%)/,""), type, null);
        }
    };

    M4TweenPlugins.rotate = {
        extractStartValue:function(pCtx)
        {
            let v = M4TweenGenericInfos.transform.extractStartValue(pCtx, this.property, this.templateValue.split("#value#"), function(pT){
                let c = Number(pT[0]);
                let s = Number(pT[1]);
                let value = Math.atan2(s, c) * (180 / Math.PI);
                if(value < 0)
                    value = 360 - value;
                return value;
            });
            this.setStartValue(v);
        },
        newInfos:function(pProperty, pFinalValue)
        {
            return M4TweenGenericInfos.transform.newInfos(pFinalValue, "rotate(#value#)", "deg");
        }
    };

    M4TweenPlugins.translateX = {
        extractStartValue:function(pCtx)
        {
            let v = M4TweenGenericInfos.transform.extractStartValue(pCtx, this.property, this.templateValue.split("#value#"), function(pT){
                return Number(pT[4]||0);
            });
            this.setStartValue(v);
        },
        newInfos:function(pProperty, pFinalValue)
        {
            return M4TweenGenericInfos.transform.newInfos(pFinalValue, "translateX(#value#)", "(px|%)");
        }
    };

    M4TweenPlugins.translateY = {
        extractStartValue:function(pCtx)
        {
            let v = M4TweenGenericInfos.transform.extractStartValue(pCtx, this.property, this.templateValue.split("#value#"), function(pT){
                return Number(pT[5]||0);
            });
            this.setStartValue(v);
        },
        newInfos:function(pProperty, pFinalValue)
        {
            return M4TweenGenericInfos.transform.newInfos(pFinalValue, "translateY(#value#)", "(px|%)");
        }
    };

    M4TweenPlugins.translateZ = {
        extractStartValue:function(pCtx)
        {
            let v = M4TweenGenericInfos.transform.extractStartValue(pCtx, this.property, this.templateValue.split("#value#"), function(pT){
                return Number(pT[14]||"0");
            });
            this.setStartValue(v);
        },
        newInfos:function(pProperty, pFinalValue)
        {
            return M4TweenGenericInfos.transform.newInfos(pFinalValue, "translateZ(#value#)", "(px|%)");
        }
    };

    let M4TweenGenericInfos = {
        transform:{
            newInfos:function(pFinalValue, pTemplate, pUnits)
            {
                let s = String(pFinalValue), p, tpl = pTemplate, t = pUnits, re = new RegExp(pUnits);
                if((p=s.search(re))>-1)
                {
                    t = s.substr(p);
                    s = s.replace(re, "");
                }
                if(M4.browser.IE)
                    p = "msTransform";
                else
                    p = "transform";
                return new M4TweenInfos(p, s, t, tpl);
            },
            extractStartValue:function(pCtx, pProperty, pTemplateParts, pCallback)
            {
                let v = pCtx[pProperty], t;
                if(v)
                {
                    if(v.indexOf("matrix")>-1)
                    {
                        t = v.split('(')[1].replace(')', '').split(', ');
                        return pCallback(t);

                    }
                    else
                    {
                        v = v.replace(pTemplateParts[0], "");
                        v = v.replace(pTemplateParts[1], "");
                        v = v==="none"?0:v;
                    }
                }
                else
                    v = 0;
                return v;
            }
        }
    };

    M4Tween.from = function(pStartValue)
    {
        return new M4Tween.Dummy(pStartValue);
    };
    M4Tween.Dummy = function(pStartValue)
    {
        this.target = {value:pStartValue};
    };
    M4Tween.Dummy.prototype =
        {
            to:function(pEndValue)
            {
                this.endValue = pEndValue;
                return this;
            },
            start:function(pDuration, pOptions)
            {
                pDuration = pDuration||1;
                pOptions = pOptions || {};
                pOptions.value = this.endValue;
                pOptions.useStyle = false;
                return M4Tween.to(this.target, pDuration, pOptions);
            }
        };

    /**Easing Equations by Robert Penner (http://www.robertpenner.com/easing/ - BSD License)**/
    M4Tween.Linear = {};
    M4Tween.Linear.easeNone = function(t, b, c, d){return (c*t/d) + b;};
    M4Tween.Back = {};
    M4Tween.Back.easeIn = function (t, b, c, d, s){if(!s){s=1.70158;}return c*(t/=d)*t*((s+1)*t - s) + b;};
    M4Tween.Back.easeOut = function (t, b, c, d, s){if(!s){s=1.70158;}return c*((t=t/d-1)*t*((s+1)*t + s) + 1) + b;};
    M4Tween.Back.easeInOut = function (t, b, c, d, s){if(!s){s=1.70158;}if ((t/=d/2) < 1) return c/2*(t*t*(((s*=(1.525))+1)*t - s)) + b;return c/2*((t-=2)*t*(((s*=(1.525))+1)*t + s) + 2) + b;};
    M4Tween.Bounce = {};
    M4Tween.Bounce.easeOut = function(t, b, c, d) {if ((t/=d) < (1/2.75)) {return c*(7.5625*t*t) + b;}else if (t < (2/2.75)) {return c*(7.5625*(t-=(1.5/2.75))*t + .75) + b;}else if (t < (2.5/2.75)) {return c*(7.5625*(t-=(2.25/2.75))*t + .9375) + b;} else {return c*(7.5625*(t-=(2.625/2.75))*t + .984375) + b;}};
    M4Tween.Bounce.easeIn = function(t, b, c, d){return c - Bounce.easeOut(d-t, 0, c, d) + b;};
    M4Tween.Bounce.easeInOut = function (t, b, c, d){if (t < d/2) return Bounce.easeIn (t*2, 0, c, d) * .5 + b;else return Bounce.easeOut (t*2-d, 0, c, d) * .5 + c*.5 + b;};
    M4Tween.Quad = {};
    M4Tween.Quad.easeIn = function (t, b, c, d) {return c*(t/=d)*t + b;};
    M4Tween.Quad.easeOut = function (t, b, c, d){return -c *(t/=d)*(t-2) + b;};
    M4Tween.Quad.easeInOut = function (t, b, c, d){if ((t/=d/2) < 1) return c/2*t*t + b;return -c/2 * ((--t)*(t-2) - 1) + b;};
    M4Tween.Circ = {};
    M4Tween.Circ.easeIn = function (t, b, c, d){return ((-c * (Math.sqrt(1 - (t/=d)*t) - 1)) + b);};
    M4Tween.Circ.easeOut = function (t, b, c, d) {return ((c * Math.sqrt(1 - (t=t/d-1)*t)) + b);};
    M4Tween.Circ.easeInOut = function (t, b, c, d){if ((t/=d/2) < 1) return -c/2 * (Math.sqrt(1 - t*t) - 1) + b;return c/2 * (Math.sqrt(1 - (t-=2)*t) + 1) + b;};
    M4Tween.Elastic = {};
    M4Tween.Elastic.easeOut = function (t, b, c, d, a, p) {let s;if (t===0) return b;  if ((t/=d)===1) return b+c;  if (!p) p=d*.3;if (!a || a < Math.abs(c)) { a=c; s = p/4; }else s = p/(Math.PI*2) * Math.asin (c/a);return (a*Math.pow(2,-10*t) * Math.sin( (t*d-s)*(Math.PI*2)/p ) + c + b);};
    M4Tween.Elastic.easeInOut = function (t, b, c, d, a, p){let s;if (t===0) return b;  if ((t/=d/2)===2) return b+c;  if (!p) p=d*(.3*1.5); if (!a || a < Math.abs(c)) { a=c; s = p/4; }else s = p/(Math.PI*2) * Math.asin (c/a); if (t < 1) return -.5*(a*Math.pow(2,10*(t-=1)) * Math.sin( (t*d-s)*(Math.PI*2)/p )) + b; return a*Math.pow(2,-10*(t-=1)) * Math.sin( (t*d-s)*(Math.PI*2)/p )*.5 + c + b;};
    M4Tween.Elastic.easeIn = function (t, b, c, d, a, p){let s;if (t===0) return b;  if ((t/=d)===1) return b+c;  if (!p) p=d*.3;if (!a || a < Math.abs(c)) { a=c; s = p/4; }else s = p/(Math.PI*2) * Math.asin (c/a);return -(a*Math.pow(2,10*(t-=1)) * Math.sin( (t*d-s)*(Math.PI*2)/p )) + b;};

    return M4Tween;
})();