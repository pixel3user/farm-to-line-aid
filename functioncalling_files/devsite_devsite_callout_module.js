(function(_ds){var window=this;var Fqa=async function(a,b){const c=a.o;let d;const e=b.id!==((d=a.oa)==null?void 0:d.id);e&&(a.className=b.id,a.eventLabel=`devsite-callout-${b.id}`,a.o=new _ds.pQ(b.origin,a.eventLabel));a.oa=b;c&&e&&await _ds.oQ(c)},Gqa=async function(a){a.eventHandler.listen(document.body,"devsite-before-page-change",()=>{a.hide()})},Hqa=async function(a,b){let c;((c=a.callout)==null?0:c.Gf)&&a.callout.Gf(b);await a.hide();a.Ba({category:"Site-Wide Custom Events",action:"callout-dismiss",label:a.eventLabel})},
S_=async function(a,b){let c;((c=a.callout)==null?0:c.sf)&&a.callout.sf(b);let d;((d=a.callout)==null?0:d.nj)||await a.hide();a.Ba({category:"Site-Wide Custom Events",action:"callout-action",label:a.eventLabel})},Iqa=function(a){let b,c;if(((b=a.callout)==null?0:b.Ke)&&`${(c=a.callout)==null?void 0:c.Ke}`){let d,e;return(0,_ds.M)`<div class="devsite-callout-branding">
          <img
            class="devsite-callout-branding-image"
            src="${(d=a.callout)==null?void 0:d.Ke}"
            alt="${((e=a.callout)==null?void 0:e.Kg)||""}" />
        </div>
        <hr />`}return(0,_ds.M)``},Jqa=function(a){let b,c;if(((b=a.callout)==null?0:b.cq)&&`${(c=a.callout)==null?void 0:c.cq}`){let d,e;return(0,_ds.M)`<div class="devsite-callout-hero">
        <img
          class="devsite-callout-hero-image"
          src="${(d=a.callout)==null?void 0:d.cq}"
          alt="${((e=a.callout)==null?void 0:e.bA)||""}" />
      </div>`}return(0,_ds.M)``},Kqa=function(a){let b;if((b=a.callout)==null?0:b.Ft)return(0,_ds.M)``;let c;return(0,_ds.M)` <div class="devsite-callout-header">
        <h2>${((c=a.callout)==null?void 0:c.title)||""}</h2>
      </div>`},Lqa=function(a){let b;if((b=a.callout)==null?0:b.loading)return(0,_ds.M)`<div class="devsite-callout-body"
        ><devsite-spinner size="24"></devsite-spinner
      ></div>`;let c,d;var e;if(((c=a.callout)==null?0:c.body)&&`${(d=a.callout)==null?void 0:d.body}`){{let f;if(((f=a.callout)==null?void 0:f.body)instanceof _ds.jg){let g;a=(0,_ds.M)`${(0,_ds.EP)((g=a.callout)==null?void 0:g.body)}`}else a=(0,_ds.M)`${(e=a.callout)==null?void 0:e.body}`}e=(0,_ds.M)`<div class="devsite-callout-body">
        ${a}
      </div>`}else e=(0,_ds.M)``;return e},Mqa=function(a){var b;if((b=a.callout)==null||!b.qd)return(0,_ds.M)``;var c;b=(0,_ds.bz)({button:!0,"button-primary":!0,"devsite-callout-action":!0,"button-disabled":((c=a.callout)==null?void 0:c.Is)||!1});let d;c=(d=a.callout)==null?void 0:d.Tx;let e;if((e=a.callout)==null?0:e.rk){let g,h;return(0,_ds.M)`<a
        @click=${k=>{S_(a,k)}}
        href="${((g=a.callout)==null?void 0:g.rk)||""}"
        class="${b}"
        aria-label=${c!=null?c:_ds.oA}
        data-title=${c!=null?c:_ds.oA}>
        ${((h=a.callout)==null?void 0:h.qd)||""}
      </a>`}let f;return(0,_ds.M)`<button
        @click=${g=>{S_(a,g)}}
        class="${b}"
        aria-label=${c!=null?c:_ds.oA}
        data-title=${c!=null?c:_ds.oA}>
        ${((f=a.callout)==null?void 0:f.qd)||""}
      </button>`},T_=class extends _ds.aC{set callout(a){Fqa(this,a)}get callout(){return this.oa}get open(){let a;return((a=this.ma.value)==null?void 0:a.open)||!1}constructor(){super(["devsite-spinner"]);this.eventHandler=new _ds.u;this.eventLabel="";this.oa=this.ea=this.o=null;this.ma=new _ds.AP}connectedCallback(){super.connectedCallback();Gqa(this)}disconnectedCallback(){super.disconnectedCallback();let a;(a=this.o)==null||a.cancel()}Ma(){return this}async ready(){await this.j}async show(){await this.ready();
if(!this.open){var a;await ((a=this.o)==null?void 0:a.schedule(()=>{document.activeElement instanceof HTMLElement&&(this.ea=document.activeElement);var b;(b=this.ma.value)==null||b.show();let c;(c=this.querySelector(".devsite-callout-action"))==null||c.focus();let d;b={message:(((d=this.callout)==null?void 0:d.title)||"")+" dialog opened"};document.body.dispatchEvent(new CustomEvent("devsite-a11y-announce",{detail:b}));this.Ba({category:"Site-Wide Custom Events",action:"callout-impression",label:this.eventLabel,
nonInteraction:!0})},()=>{let b;(b=this.ma.value)==null||b.close();let c;(c=this.querySelector(".devsite-callout-action"))==null||c.blur();this.ea&&this.ea.focus()}))}}async hide(){await this.ready();let a;await ((a=this.o)==null?void 0:_ds.oQ(a))}render(){if(!this.callout)return(0,_ds.M)``;let a;return(0,_ds.M)`
      <dialog
        closedby="none"
        ${(0,_ds.CP)(this.ma)}
        aria-label="${((a=this.callout)==null?void 0:a.title)||""}"
        class="devsite-callout">
        ${Iqa(this)} ${Jqa(this)}
        ${Kqa(this)} ${Lqa(this)}
        <div class="devsite-callout-buttons">
          <button
            @click=${b=>{Hqa(this,b)}}
            class="button button-dismiss devsite-callout-dismiss">
            ${"Dismiss"}
          </button>
          ${Mqa(this)}
        </div>
      </dialog>
    `}};_ds.w([_ds.F({Aa:!1}),_ds.x("design:type",Object),_ds.x("design:paramtypes",[Object])],T_.prototype,"callout",null);try{customElements.define("devsite-callout",T_)}catch(a){console.warn("Unrecognized DevSite custom element - DevsiteCallout",a)};})(_ds_www);
