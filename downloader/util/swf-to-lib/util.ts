export function tryParse (value:string) {
    try {
        return JSON.parse(value)
    } catch (e) {
        return value
    }
}