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
const exec = require('child-process-promise').exec;
const pl = require('../plugins/plugin_loader.js');
const event = require('../core/event.js');

const sclient = require('../util/redis_manager.js').getSubscriptionClient();

class IPChangeSensor extends Sensor {

  async run() {
    sclient.on("message", (channel, message) => {
      let eventType = event.EVENT_IP_CHANGE;
      switch (channel) {
        case "pppoe.ip_change":
        case "dhclient.ip_change":
        case "dhcpcd6.ip_change": {
          eventType = event.EVENT_IP_CHANGE;
          break;
        }
        case "dhcpcd6.pd_change":
          eventType = event.EVENT_PD_CHANGE;
          break;
        default:
          return;
      }
      const iface = message;
      const intfPlugin = pl.getPluginInstance("interface", iface);
      if (intfPlugin) {
        const e = event.buildEvent(eventType, { intf: iface });
        if (this.config.delay) {
          setTimeout(() => {
            intfPlugin.propagateEvent(e);
          }, this.config.delay * 1000);
        } else {
          intfPlugin.propagateEvent(e);
        }
        const uuid = intfPlugin.networkConfig && intfPlugin.networkConfig.meta && intfPlugin.networkConfig.meta.uuid;
        if (uuid) {
          // publish to redis db used by Firewalla
          exec(`redis-cli publish "firerouter.iface.ip_change" "${uuid}"`);
        }
      }
    });

    sclient.subscribe("dhclient.ip_change");
    sclient.subscribe("pppoe.ip_change");
    sclient.subscribe("dhcpcd6.ip_change");
    sclient.subscribe("dhcpcd6.pd_change");
  }
}

module.exports = IPChangeSensor;