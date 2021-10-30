class LinkItemResource5e {
  static MODULE_NAME = "link-item-resource-5e";
  static MODULE_TITLE = "Link Item and Resource DnD5e";

  static TEMPLATES = {
    resourceSelect: `modules/${this.MODULE_NAME}/templates/resource-select.hbs`
  }

  static init = async () => {
    console.log(`${this.MODULE_NAME} | Initializing ${this.MODULE_TITLE}`);

    loadTemplates(Object.values(this.TEMPLATES));
  }

}

Hooks.on("ready", LinkItemResource5e.init);


class LinkItemResource5eItemSheet {
  static item;

  static capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }
  
  static inject = async (html, {resourceOptions, currentValue}) => {
    const select = await renderTemplate(LinkItemResource5e.TEMPLATES.resourceSelect, {
      resourceOptions,
      currentValue
    })

    const el = html.find('.uses-per').first()
    
    el.after(select);
  }

  static handleRender = async (itemSheet, html) => {
    // debugger;
    this.item = itemSheet.item;
    this.actor = this.item.actor;

    if (this.item.parent?.type !== 'character' || !this.item.hasLimitedUses || !this.actor) {
      return;
    }

    const {value, max, per} = this.item.data.data.uses ?? {};

    const resourceOptions = Object.keys(this.actor.data.data.resources).reduce((acc, resourceKey) => {
      acc[resourceKey] = game.i18n.localize(`DND5E.Resource${this.capitalizeFirstLetter(resourceKey)}`);
      return acc
    }, {});

    const currentValue = this.item.getFlag(LinkItemResource5e.MODULE_NAME, 'resource-link');

    
    const select = await renderTemplate(LinkItemResource5e.TEMPLATES.resourceSelect, {
      resourceOptions,
      currentValue
    })

    const el = html.find('.uses-per').first()
    
    el.after(select);
    // inject(html, {resourceOptions, currentValue})
  }
}

Hooks.on('renderItemSheet', LinkItemResource5eItemSheet.handleRender);