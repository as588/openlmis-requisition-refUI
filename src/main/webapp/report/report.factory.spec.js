/*
 * This program is part of the OpenLMIS logistics management information system platform software.
 * Copyright © 2017 VillageReach
 *
 * This program is free software: you can redistribute it and/or modify it under the terms
 * of the GNU Affero General Public License as published by the Free Software Foundation, either
 * version 3 of the License, or (at your option) any later version.
 *  
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. 
 * See the GNU Affero General Public License for more details. You should have received a copy of
 * the GNU Affero General Public License along with this program. If not, see
 * http://www.gnu.org/licenses.  For additional information contact info@OpenLMIS.org. 
 */

describe('reportFactory', function() {

  // mocks
  var path = '/path';
  var response = [
    { name: 'name1', id: 'ee22d7db-e068-4eef-ad45-2b3b4bbb04b2' },
    { name: 'name2', id: '6b6c2dfb-7b7a-4144-bbd5-343fcce443a5' }
  ];

  // injects
  var $httpBackend, reportFactory;

  beforeEach(function() {
    module('report');

    inject(function(_$httpBackend_, _reportFactory_, openlmisUrlFactory) {
      reportFactory = _reportFactory_;
      $httpBackend = _$httpBackend_;

      $httpBackend.when('GET', openlmisUrlFactory(path))
        .respond(200, response);
    });
  });

  it('should get values for parameters with property access', function() {
    var result;

    reportFactory.getParameterOptions(path, 'id', 'name')
    .then(function(items) {
        result = items;
    });

    $httpBackend.flush();

    expect(result.length).toBe(response.length);
    expect(result[0].name).toBe(response[0].name);
    expect(result[0].value).toBe(response[0].id);
    expect(result[1].name).toBe(response[1].name);
    expect(result[1].value).toBe(response[1].id);
  });

  it('should get values for parameters without property access', function() {
    var result;

    reportFactory.getParameterOptions(path, null, null)
    .then(function(items) {
        result = items;
    });

    $httpBackend.flush();

    expect(result.length).toBe(response.length);
    expect(result[0].value.name).toBe(response[0].name);
    expect(result[0].name).toBe(result[0].value);
    expect(result[1].value.name).toBe(response[1].name);
    expect(result[1].name).toBe(result[1].value);
  });

});
