class LinkItemResource5e {
  static MODULE_NAME = "link-item-resource-5e";
  static MODULE_TITLE = "Link Item and Resource DnD5e";

  static TEMPLATES = {
    resourceSelect: `modules/${this.MODULE_NAME}/templates/resource-select.hbs`
  }

  static setup = () => {
    console.log(`${this.MODULE_NAME} | Initializing ${this.MODULE_TITLE}`);

    loadTemplates(Object.values(this.TEMPLATES));

    libWrapper.register(LinkItemResource5e.MODULE_NAME, 'CONFIG.Actor.documentClass.prototype.prepareData', LinkItemResource5eActor.prepareDerivedResources, "WRAPPER");
  }

  static handlePreItemUpdate = (item, updateData) => {
    const flagPath = `flags.${this.MODULE_NAME}.resource-link`;
    const actor = item.actor;
    const currentValue = item.getFlag(this.MODULE_NAME, 'resource-link');
    const newValue = foundry.utils.getProperty(updateData, flagPath);
    debugger;

    if (!foundry.utils.hasProperty(updateData, flagPath)) {
      return;
    }

    if (item.parent?.type !== 'character' || !item.hasLimitedUses || !actor) {
      return;
    }

    // either update the actor or we have to hijack the prepareData somehow
    const currentOverrides = actor.getFlag(this.MODULE_NAME, 'resource-overrides');

    let actorUpdates = {};
    const newFlags = {
      ...currentOverrides,
    }

    // always remove this item from the mapping first to ensure the item is only in the overrides once
    Object.keys(currentOverrides).forEach((resourceKey) => {
      if (newFlags[resourceKey] === item.id) {
        delete newFlags[currentValue];
        newFlags[`-=${resourceKey}`] = null;
      }
    })

    if (!!newValue) {
      // the item now wants to link
      newFlags[newValue] = item.id;
    }

    actor.update({
      [`flags.${this.MODULE_NAME}.resource-overrides`]: newFlags,
    });
  }

}

Hooks.on("setup", LinkItemResource5e.setup);
Hooks.on("preUpdateItem", LinkItemResource5e.handlePreItemUpdate);

class LinkItemResource5eItemSheet {
  static capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  static handleRender = async (itemSheet, html) => {
    const item = itemSheet.item;
    const actor = item.actor;

    if (item.parent?.type !== 'character' || !item.hasLimitedUses || !actor) {
      return;
    }

    const resourceOptions = Object.keys(actor.data.data.resources)
      .reduce((acc, resourceKey) => {
        acc[resourceKey] = game.i18n.localize(`DND5E.Resource${this.capitalizeFirstLetter(resourceKey)}`);
        return acc
      }, {});

    const currentValue = item.getFlag(LinkItemResource5e.MODULE_NAME, 'resource-link');

    const select = await renderTemplate(LinkItemResource5e.TEMPLATES.resourceSelect, {
      resourceOptions,
      currentValue,
    })

    const el = html.find('.uses-per').first()

    el.after(select);
    itemSheet.setPosition();
  }
}

Hooks.on('renderItemSheet', LinkItemResource5eItemSheet.handleRender);

class LinkItemResource5eActor {
  // has to run after all the owned items have run `prepareFinalAttributes` so items have numerical charges
  static prepareDerivedResources(wrapped, ...args) {
    wrapped(...args);

    const actorData = this.data;
    const data = actorData.data;
    const items = this.items;

    // Record<resourceName, itemId>
    const resourceOverrides = this.getFlag(LinkItemResource5e.MODULE_NAME, 'resource-overrides');

    if (!resourceOverrides) {
      return;
    }

    Object.entries(resourceOverrides).forEach(([resource, itemId]) => {
      const relevantItem = items.get(itemId)
      if (!relevantItem) return;
      const { value, max, per } = relevantItem.data.data.uses ?? {};

      data.resources[resource] = {
        label: relevantItem.name,
        value,
        max,
        sr: per === 'sr',
        lr: ['sr', 'lr'].includes(per),
      }
    });
  }

  /**
   * Mutates `updateData` to correctly update the item instead of the actor resource in cases
   * where the resource is overridden.
   * @param {*} actor 
   * @param {*} updateData 
   * @returns 
   */
  static handlePreUpdateActor = (actor, updateData) => {
    const currentOverrides = actor.getFlag(LinkItemResource5e.MODULE_NAME, 'resource-overrides');
    
    // get any updates to the actor's resources
    const resourceUpdates = foundry.utils.getProperty(updateData, `data.resources`);
    if (!currentOverrides || !resourceUpdates) {
      return;
    }

    // array of resource keys which are being updated that have overrides
    const updatesToOverriddenResources = Object.keys(resourceUpdates)
      .filter((resource) => !!currentOverrides[resource]);

    // abort if there's none we care about
    if (!updatesToOverriddenResources.length) {
      return;
    }
    debugger;

    // construct item updates based on the updateData
    const itemUpdates = updatesToOverriddenResources
      .map((resourceKey) => ({
        _id: currentOverrides[resourceKey],
        'data.uses.value': resourceUpdates[resourceKey].value,
      }))

    // add the item updates to this update operation
    updateData.items = [...(updateData?.items ?? []), ...itemUpdates];

    // set the overridden resource update to undefined
    updatesToOverriddenResources.forEach((resourceKey) => {
      foundry.utils.setProperty(updateData, `data.resources.${resourceKey}`, undefined);
    });
  }
}

Hooks.on('preUpdateActor', LinkItemResource5eActor.handlePreUpdateActor);

class LinkItemResource5eActorSheet {

  // from 5e sheet resources plus module
  static sheetResources = [
    "primary",
    "secondary",
    "tertiary",
    "fourth",
    "fifth",
    "sixth",
    "seventh",
    "eighth",
    "ninth",
    "tenth",
    "eleventh",
    "twelfth",
    "thirteenth",
    "fourteenth",
    "fifteenth",
    "sixteenth",
    "seventeenth",
    "eighteenth",
    "nineteenth",
    "twentieth",
    "count",
  ];

  static getIndexFromResourceName = (resourceName) => {
    return this.sheetResources.indexOf(resourceName);
  }

  // has to run after all the owned items have run `prepareFinalAttributes` so items have numerical charges
  static disableDerivedFields = (actorSheet, html) => {
    const actor = actorSheet.actor;
    const resourceOverrides = actor.getFlag(LinkItemResource5e.MODULE_NAME, 'resource-overrides');

    if (!resourceOverrides) {
      return;
    }

    const indexesToDisable = Object.keys(resourceOverrides).map(this.getIndexFromResourceName);

    const resourceElements = html.find('.resource');

    // get the resources which have overrides to disable inputs
    indexesToDisable.forEach( index => {
      const element = resourceElements[index];
      // disable every input except the `value` input
      $(element).find('[name]').filter((index, el) => !el.name.includes('value')).prop('disabled', true);
    })
  }
}

Hooks.on('renderActorSheet5eCharacter', LinkItemResource5eActorSheet.disableDerivedFields);