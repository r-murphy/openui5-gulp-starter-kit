/**
 *
 *  OpenUI5 Cache Buster
 *  Copyright 2017 PulseShift GmbH. All rights reserved.
 *
 *  Licensed under the MIT License.
 *
 *  This file makes use of new JavaScript features.
 *  Babel handles this without us having to do anything. It just works.
 *  You can read more about the new JavaScript features here:
 *  https://babeljs.io/docs/learn-es2015/
 *
 */

import loaderUtils from 'loader-utils'
import fs from 'fs'
import path from 'path'

// hash generation options
const HASH_TYPE = 'sha512'
const DIGEST_TYPE = 'base62'
const MAX_LENGTH = 8

/**
 * Hash UI5 module (app component) paths (content based) to enable cache buster:
 *
 * e.g.: ./webapps/my-app --> ./webapps/XDBq1b7n
 * The hash depends on:
 * ./webapps/my-app/Component-preload.js
 * ./webapps/ps-sample-app/style/style.css
 *
 * The UI5 resource roots in the main HTML will be updated with the generated hashes.
 * @param {Vinyl} [oHTMLFile] Main HTML file.
 * @returns {Vinyl} Updated HTML file.
 */
export default function ui5Bust(oHTMLFile) {
  const sHTMLContent = oHTMLFile.contents.toString('utf8')
  // extract resource roots JSON string
  const sResourceRootMarker = 'data-sap-ui-resourceroots='
  const iJSONStartsAt =
    sHTMLContent.indexOf(sResourceRootMarker) + sResourceRootMarker.length + 1
  const iJSONEndsAt = sHTMLContent.indexOf("'", iJSONStartsAt)
  const sResourceRoots = sHTMLContent.substring(iJSONStartsAt, iJSONEndsAt)
  const oResouceRoots = JSON.parse(sResourceRoots)
  const aAppNames = Object.keys(oResouceRoots)

  // loop at apps and modify relevant directories and files
  const oNewResouceRoots = aAppNames.reduce((oNewResouceRoots, sAppName) => {
    // do something...
    const sAppPath = oResouceRoots[sAppName]
    const sResolvedAppPath = path.resolve(
      oHTMLFile.cwd,
      path.dirname(oHTMLFile.path),
      sAppPath
    )

    // read relevant resources for hash generation
    const oFileContent = fs.readFileSync(
      path.resolve(sResolvedAppPath, 'Component-preload.js'),
      'utf8'
    )

    // generate hash based on resource contents of the app
    const sNewHash = loaderUtils.getHashDigest(
      Buffer.concat([new Buffer(oFileContent)]),
      HASH_TYPE,
      DIGEST_TYPE,
      MAX_LENGTH
    )

    // compose new app path
    const aPathChain = sAppPath.split('/')
    const sOriginDirectory = aPathChain[aPathChain.length - 1]
    const sNewHashedAppPath = sResolvedAppPath.replace(
      new RegExp(`${sOriginDirectory}$`),
      sNewHash
    )

    // rename resource root folder
    fs.renameSync(sResolvedAppPath, sNewHashedAppPath)

    // update resource roots
    oNewResouceRoots[sAppName] = sNewHash
    return oNewResouceRoots
  }, {})

  // update resource roots in HTML file
  const sStringifiedResourceRoots = JSON.stringify(oNewResouceRoots)
  const sNewHTMLContent = sHTMLContent.replace(
    /data-sap-ui-resourceroots=(.*)>/g,
    `data-sap-ui-resourceroots='${sStringifiedResourceRoots}'>`
  )
  oHTMLFile.contents = new Buffer(sNewHTMLContent)

  // return updated index.html again
  return oHTMLFile
}