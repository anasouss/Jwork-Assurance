package com.assurance.service;

import com.assurance.activity.ActivityAction;
import com.assurance.activity.ActivityCommand;
import com.assurance.activity.BusinessActivityRecorder;
import com.assurance.activity.CompanyCatalogueActivity;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.function.Supplier;

/** Transaction boundary for catalogue handlers that historically wrote directly through repositories. */
@Service
@RequiredArgsConstructor
public class CatalogueActivityService {
    private final BusinessActivityRecorder recorder;

    @Transactional
    public <T> T perform(Supplier<T> operation) {
        return operation.get();
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(CompanyCatalogueActivity.State before, CompanyCatalogueActivity.State after,
            ActivityAction action, String title, String origin) {
        record(CompanyCatalogueActivity.command(before, after, action, title, origin));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(ActivityCommand command) {
        if (command.agenceId() == null) recorder.recordGlobalReference(command);
        else recorder.record(command);
    }
}
