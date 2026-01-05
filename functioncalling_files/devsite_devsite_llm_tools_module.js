(function(_ds){var window=this;var Eva=async function(a){a.eventHandler.listen(a,"DropdownToggled",c=>{c=c.getBrowserEvent();let d;a.Ba({category:"devsiteLlmTools",action:((d=c.detail)==null?0:d.open)?"llm_tools_dropdown_open":"llm_tools_dropdown_close",label:"dropdown_toggle"})});a.eventHandler.listen(a,"DropdownItemClicked",c=>{c=c.getBrowserEvent();if(c=a.ea.get(c.detail.id))a.Ba({category:"devsiteLlmTools",action:c.Wx,label:c.analyticsLabel}),c.action()});const b=Dva();b&&(a.o=b,a.Ba({category:"devsiteLlmTools",action:"llm_tools_button_impression"}))},
Dva=function(){const a=_ds.C();a.pathname=`${a.pathname}.md.txt`;return _ds.ag(a.href)},Fva=async function(a){if(!a.o)return null;a.Bl=!0;try{const b=await fetch(_ds.wo(a.o.toString()).href);if(b)return await b.text()}catch(b){}finally{a.Bl=!1}return null},Gva=async function(a){try{return a.ma||(a.ma=await Fva(a)),a.ma}catch(b){}return null},F4=function(a,b){a.dispatchEvent(new CustomEvent("devsite-show-custom-snackbar-msg",{detail:{msg:b,showClose:!1},bubbles:!0}))},Hva=async function(a){a.Ba({category:"devsiteLlmTools",
action:"llm_tools_copy_markdown_click",label:"main_button"});const b=await Gva(a);b?await _ds.Yy(b):F4(a,"Failed to copy page")},G4=class extends _ds.aC{constructor(){super(...arguments);this.Bl=!1;this.eventHandler=new _ds.u;this.ma=null;this.o=void 0;this.items=[{id:"open-markdown",title:"View as Markdown",action:()=>{this.o?_ds.mg(window,this.o,"_blank"):F4(this,"Failed to open markdown view.")},Wx:"llm_tools_open_markdown_click",analyticsLabel:"dropdown_item"}];this.oa=this.items.map(a=>({id:a.id,
title:a.title}));this.ea=new Map(this.items.map(a=>[a.id,a]))}Ma(){return this}connectedCallback(){super.connectedCallback();Eva(this)}disconnectedCallback(){super.disconnectedCallback();_ds.D(this.eventHandler)}render(){return(0,_ds.M)`
      <div
        class="devsite-llm-tools-container"
        role="group"
        aria-label="${"LLM Tools"}">
        <div class="devsite-llm-tools-button-container">
          <button
            type="button"
            class="button button-white devsite-llm-tools-button"
            ?disabled="${this.Bl}"
            @click=${()=>{Hva(this)}}
            aria-label="${"Copy page as markdown"}"
            data-title="${"Copy Page"}">
            <span class="material-icons" aria-hidden="true">content_copy</span>
          </button>
        </div>
        <div class="devsite-llm-tools-dropdown-container">
          <devsite-dropdown-list
            .listItems="${this.oa}"
            open-dropdown-aria-label="${"More LLM Tools options"}"
            close-dropdown-aria-label="${"Close LLM Tools options menu"}">
          </devsite-dropdown-list>
        </div>
      </div>
    `}};G4.prototype.disconnectedCallback=G4.prototype.disconnectedCallback;_ds.w([_ds.H(),_ds.x("design:type",Object)],G4.prototype,"Bl",void 0);try{customElements.define("devsite-llm-tools",G4)}catch(a){console.warn("Unrecognized DevSite custom element - DevsiteLlmTools",a)};})(_ds_www);
