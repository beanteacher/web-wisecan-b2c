package com.wisecan.unified.exception;

public class EntityNotFoundException extends RuntimeException {

    private final String entityName;
    private final Long id;

    public EntityNotFoundException(String displayName, Long id) {
        super(displayName + "을(를) 찾을 수 없습니다. (ID: " + id + ")");
        this.entityName = displayName;
        this.id = id;
    }

    public String getEntityName() { return entityName; }
    public Long getId() { return id; }
}
