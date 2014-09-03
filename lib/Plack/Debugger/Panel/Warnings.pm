package Plack::Debugger::Panel::Warnings;

use strict;
use warnings;

use parent 'Plack::Debugger::Panel';

sub new {
    my $class = shift;
    my %args  = @_ == 1 && ref $_[0] eq 'HASH' ? %{ $_[0] } : @_;

    $args{'title'} ||= 'Warnings';

    $args{'before'} = sub {
        my ($self, $env) = @_;
        $self->stash([]);
        $SIG{'__WARN__'} = sub { 
            push @{ $self->stash } => @_;
            $self->notify('warning');
            CORE::warn @_;
        };
    };

    $args{'after'} = sub {
        my ($self, $env, $resp) = @_;
        $SIG{'__WARN__'} = 'DEFAULT';  
        $self->set_result( $self->stash ); 
    };

    $class->SUPER::new( \%args );
}


1;

__END__