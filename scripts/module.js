/**
 * Overall class containing the setup logic
 */
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

    Hooks.on("preUpdateItem", LinkItemResource5eItem.handlePreItemUpdate);
    Hooks.on('renderItemSheet', LinkItemResource5eItemSheet.handleRender);
    Hooks.on('preUpdateActor', LinkItemResource5eActor.handlePreUpdateActor);
    Hooks.on('renderActorSheet5eCharacter', LinkItemResource5eActorSheet.handleActorSheetRender);
  }
}

Hooks.on("setup", LinkItemResource5e.setup);

/**
 * Contains all resource-linking logic related to the Item document
 */
class LinkItemResource5eItem {
  /**
   * preUpdateItem hook callback
   * Updates the parent actor's flags detailing which resources are overriden when
   * the resource-link flag on the item is changed
   * @param {*} item 
   * @param {*} updateData 
   * @returns 
   */
  static handlePreItemUpdate = (item, updateData) => {
    const flagPath = `flags.${LinkItemResource5e.MODULE_NAME}.resource-link`;
    const actor = item.actor;
    const currentValue = item.getFlag(LinkItemResource5e.MODULE_NAME, 'resource-link');
    const newValue = foundry.utils.getProperty(updateData, flagPath);

    if (!foundry.utils.hasProperty(updateData, flagPath)) {
      return;
    }

    if (item.parent?.type !== 'character' || !item.hasLimitedUses || !actor) {
      return;
    }

    // either update the actor or we have to hijack the prepareData somehow
    const currentOverrides = actor.getFlag(LinkItemResource5e.MODULE_NAME, 'resource-overrides');

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

    actor.setFlag(LinkItemResource5e.MODULE_NAME, 'resource-overrides', newFlags);
  }
}


/**
 * Contains all resource-linking logic related to the ItemSheet
 */
class LinkItemResource5eItemSheet {
  static capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  /**
   * renderItemSheet Hook callback
   * Injects the input for selecting a resouce to override
   * @param {*} itemSheet 
   * @param {*} html 
   * @returns 
   */
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


/**
 * Contains all resource-linking logic related to the Actor Document
 */
class LinkItemResource5eActor {
  /**
   * `Actor5e.prepareData` WRAPPER
   * Overrides the flagged resources with item details.
   * Has to run after all the owned items have run `prepareFinalAttributes` so items have numerical charges
   * @param {*} wrapped 
   * @param  {...any} args 
   * @returns 
   */
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
   * preUpdateActor hook callback
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


/**
 * Contains all resource-linking logic related to the ActorSheet
 */
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

  /**
   * renderActorSheet hook callback
   * @param {*} actorSheet 
   * @param {*} html 
   * @returns 
   */
  static handleActorSheetRender = (actorSheet, html) => {
    const actor = actorSheet.actor;
    const resourceOverrides = actor.getFlag(LinkItemResource5e.MODULE_NAME, 'resource-overrides');

    if (!resourceOverrides) {
      return;
    }

    this.disableDerivedResourceFields(resourceOverrides, html);
    this.disableOverriddenItemFields(resourceOverrides, html);
  }

  /**
   * Disables all inputs in an overriden resource fieldset except `value`.
   * @param {*} resourceOverrides
   * @param {*} html
   */
  static disableDerivedResourceFields = (resourceOverrides, html) => {
    const indexesToDisable = Object.keys(resourceOverrides).map(this.getIndexFromResourceName);
    const resourceElements = html.find('.resource');

    // get the resources which have overrides to disable inputs
    indexesToDisable.forEach(index => {
      const element = resourceElements[index];
      // disable every input except the `value` input
      $(element).find('[name]').filter((index, el) => !el.name.includes('value'))
        .prop('disabled', true)
        .prop('title', game.i18n.localize(`${LinkItemResource5e.MODULE_NAME}.disabled-resource-helper-text`));
    })
  }

  /**
   * Disables the Item Uses inputs on the inventory level for items which override resource.
   * This is necessary to avoid a double-update which results in no actual change.
   * @param {*} resourceOverrides 
   * @param {*} html 
   * @returns 
   */
  static disableOverriddenItemFields = (resourceOverrides, html) => {
    const itemIdsToDisable = Object.values(resourceOverrides);

    // get the resources which have overrides to disable inputs
    itemIdsToDisable.forEach(itemId => {
      html.find(`[data-item-id=${itemId}] .item-uses input`)
        .prop('disabled', true)
        .prop('title', game.i18n.localize(`${LinkItemResource5e.MODULE_NAME}.disabled-item-helper-text`));
    });
  }
}
