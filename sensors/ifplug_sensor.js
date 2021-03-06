/*    Copyright 2019 Firewalla Inc
 *
 *    This program is free software: you can redistribute it and/or modify
 *    it under the terms of the GNU Affero General Public License, version 3,
 *    as published by the Free Software Foundation.
 *
 *    This program is distributed in the hope that it will be useful,
 *    but WITHOUT ANY WARRANTY; without even the implied warranty of
 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *    GNU Affero General Public License for more details.
 *
 *    You should have received a copy of the GNU Affero General Public License
 *    along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
'use strict';

const Sensor = require("./sensor.js");
const r = require('../util/firerouter.js');
const ifupdownPublishScript = `${r.getFireRouterHome()}/scripts/ifupdown_publish`;
const exec = require('child-process-promise').exec;
const ncm = require('../core/network_config_mgr.js');
const pl = require('../plugins/plugin_loader.js');
const event = require('../core/event.js');

const sclient = require('../util/redis_manager.js').getSubscriptionClient();

class IfPlugSensor extends Sensor {

  static async prepare() {
    await exec(`sudo rm -rf /etc/ifplugd/action.d/*`).catch((err) => {});
    await exec(`sudo cp ${ifupdownPublishScript} /etc/ifplugd/action.d/`).catch((err) => {});
  }

  async run() {
    const ifaces = await ncm.getPhyInterfaceNames();
    const upDelay = this.config.up_delay || 5;
    for (let iface of ifaces) {
      await exec(`sudo ifplugd -pq -k -i ${iface}`).catch((err) => {});
      await exec(`sudo ifplugd -pq -i ${iface} -u ${upDelay}`).catch((err) => {
        this.log.error(`Failed to start ifplugd on ${iface}`);
      });
    }

    sclient.on("message", (channel, message) => {
      switch (channel) {
        case "ifup": {
          const iface = message;
          const intfPlugin = pl.getPluginInstance("interface", iface);
          if (intfPlugin) {
            const e = event.buildEvent(event.EVENT_IF_UP, {intf: iface});
            intfPlugin.propagateEvent(e);
          }
          break;
        }
        case "ifdown": {
          const iface = message;
          const intfPlugin = pl.getPluginInstance("interface", iface);
          if (intfPlugin) {
            const e = event.buildEvent(event.EVENT_IF_DOWN, {intf: iface});
            intfPlugin.propagateEvent(e);
          }
          break;
        }
        default:
      }
    });

    sclient.subscribe("ifup");
    sclient.subscribe("ifdown");
  }
}

module.exports = IfPlugSensor;