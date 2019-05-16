const camelCase = require('lodash/camelCase')
const upperCase = require('lodash/upperCase')
const lowerCase = require('lodash/lowerCase')
const { deCamelCaseArgs } = require('../utils/camelCase')
const debug = require('../utils/debug')
const MovieDatabase = require('./MovieDatabase')

function transformListItemInput(items) {
  return items.map(item => ({
    media_id: Number(item.id),
    media_type: lowerCase(item.mediaType)
  }))
}

/**
 * A data source for the TMDB API (V4)
 */
class MovieDatabaseV4 extends MovieDatabase {
  constructor() {
    super()
    this.baseURL = `https://api.themoviedb.org/4`
  }

  /**
   * Retrieve a list by ID.
   * Private lists can only be accessed by their owners and therefore require a
   * valid user access token.
   * @see https://developers.themoviedb.org/4/list/get-list
   */
  async getList({ id, ...params }) {
    const body = deCamelCaseArgs(params)
    const response = await this.get(`/list/${id}`, body)
    let { totalResults, totalPages, page, results, ...rest } = response
    // Move `results` and pagination info to the `items` field
    const items = { totalResults, totalPages, page, results }
    // Add `numberOfItems` field to match lists returned by myLists
    const numberOfItems = totalResults
    // Transform sortBy values to match schema
    const sortBy = rest.sortBy.replace(
      /(\w+)\.([a-z]+)/,
      (_, m1, m2) => `${camelCase(m1)}_${upperCase(m2)}`
    )
    return { ...rest, sortBy, numberOfItems, items }
  }

  /**
   * Create a new list.
   * Requires a valid user access token.
   * @see https://developers.themoviedb.org/4/list/create-list
   */
  async createList({ name, description, iso_639_1 = 'en' }) {
    try {
      const body = { name, description, iso_639_1 }
      const response = await this.post('/list', body)
      if (response.success) return response
    } catch (error) {
      debug.error(error)
      return { success: false, message: error.message }
    }
  }

  /**
   * Update list metadata and settings.
   * Can only be performed by list owner. Requires user access token.
   * @see https://developers.themoviedb.org/4/list/update-list
   */
  async updateList({ id, ...params }) {
    try {
      const response = await this.put(`/list/${id}`, deCamelCaseArgs(params))
      if (response.success) return response
    } catch (error) {
      debug.error(error)
      return { success: false, message: error.message }
    }
  }

  /**
   * Delete a list by ID.
   * Can only be performed by list owner. Requires user access token.
   */
  async deleteList({ id }) {
    try {
      const response = await this.delete(`/list/${id}`)
      if (response.success) return response
    } catch (error) {
      debug.error(error)
      return { success: false, message: error.message }
    }
  }

  /**
   * Clears all of the items from a list in a single request.
   * Requires user access token. Can only be performed by list owner.
   * @see https://developers.themoviedb.org/4/list/clear-list
   */
  async clearList({ id }) {
    try {
      const response = await this.get(`/list/${id}/clear`)
      if (response.success) return response
    } catch (error) {
      debug.error(error)
      return { success: false, message: error.message }
    }
  }

  /**
   * Adds items to a list. Items can include both movie or TV shows.
   * Supports adding an unlimited number of items in a single request
   *
   * The results of this query will return a results array. Each result
   * includes a success field. If a result is false this will usually indicate
   * that the item already exists on the list. It may also indicate that the
   * item could not be found.
   *
   * Can only be performed by list owner. Requires user access token.
   * @see https://developers.themoviedb.org/4/list/add-items
   * @param {string} id
   * @param {Array<{mediaType, mediaId}>} items
   */
  async addListItems({ id, items }) {
    try {
      const body = { items: transformListItemInput(items) }
      const response = await this.post(`/list/${id}/items`, body)
      if (response.success) return response
    } catch (error) {
      debug.error(error)
      return { success: false, message: error.message }
    }
  }

  /**
   * Remove items from a list.
   * Can only be performed by list owner. Requires user access token.
   * @see https://developers.themoviedb.org/4/list/remove-items
   */
  async removeListItems({ id, items }) {
    try {
      const body = { items: deCamelCaseArgs(items) }
      const response = await this.delete(`/list/${id}/items`, body)
      if (response.success) return response
    } catch (error) {
      debug.error(error)
      return { success: false, message: error.message }
    }
  }

  /**
   * Quickly check if the item is already added to the list.
   * Can only be performed by list owner. Requires user access token.
   */
  async checkListItemStatus({ listId, mediaType, mediaId }) {
    try {
      const params = { media_type: mediaType, mediaId: mediaId }
      const response = await this.get(`/list/${listId}/item_status`, params)
      if (response.success) return response
    } catch (error) {
      debug.error(error)
      return { success: false, message: error.message }
    }
  }

  /**
   * Get all lists created by the given user.
   * This requires a valid user access token.
   */
  async getMyLists({ accountId }) {
    try {
      return this.get(`/account/${accountId}/lists`)
    } catch (error) {
      debug.error(error)
      return { success: false, message: error.message }
    }
  }
}
module.exports = MovieDatabaseV4
